"""Recurring subscriptions and bill tracking with smart detection.

Enables tracking recurring obligations (streaming, utilities, SaaS, rent, gym),
computes projected monthly/yearly run-rates, flags upcoming renewals,
and auto-detects recurring patterns from historical transactions.
"""
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import cast

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import func, select
from werkzeug.exceptions import NotFound

import validation as v
from constants import CATEGORIES, PAYMENT_METHODS
from models import Subscription, Transaction, User, db

bp = Blueprint("subscriptions", __name__, url_prefix="/api/subscriptions")

CYCLES = ["weekly", "monthly", "quarterly", "yearly"]
STATUSES = ["active", "paused", "cancelled"]


def _me() -> User:
    return cast(User, current_user)


def _owned_or_404(sub_id: int) -> Subscription:
    sub = db.session.scalar(
        select(Subscription).where(
            Subscription.id == sub_id, Subscription.user_id == _me().id
        )
    )
    if sub is None:
        raise NotFound("Subscription not found.")
    return sub


def _advance_date(curr: date, cycle: str) -> date:
    """Advance the billing date forward by exactly one cycle."""
    if cycle == "weekly":
        return curr + timedelta(days=7)
    elif cycle == "quarterly":
        # Approx 3 months
        month = curr.month + 3
        year = curr.year + (month - 1) // 12
        month = ((month - 1) % 12) + 1
        day = min(curr.day, 28)
        return date(year, month, day)
    elif cycle == "yearly":
        try:
            return curr.replace(year=curr.year + 1)
        except ValueError:
            return curr.replace(year=curr.year + 1, day=28)
    else:  # monthly
        month = curr.month + 1
        year = curr.year + (month - 1) // 12
        month = ((month - 1) % 12) + 1
        day = min(curr.day, 28)
        return date(year, month, day)


def _detect_recurring_txns(user_id: int, existing_names: set[str]) -> list[dict]:
    """Scan recent transactions for repeating merchant names and amounts."""
    ninety_days_ago = date.today() - timedelta(days=120)
    txns = db.session.scalars(
        select(Transaction)
        .where(
            Transaction.user_id == user_id,
            Transaction.txn_type == "expense",
            Transaction.date >= ninety_days_ago,
        )
        .order_by(Transaction.date.desc())
    ).all()

    # Group by description
    grouped: dict[str, list[Transaction]] = defaultdict(list)
    for t in txns:
        norm = t.description.strip().title()
        grouped[norm].append(t)

    suggestions = []
    for desc, group in grouped.items():
        if desc.lower() in existing_names or len(group) < 2:
            continue

        # Check if amounts are consistent (stddev or match)
        amounts = [float(t.amount) for t in group]
        avg_amt = sum(amounts) / len(amounts)
        # Consistent if all within 10% of average
        if all(abs(a - avg_amt) / avg_amt < 0.1 for a in amounts):
            suggestions.append({
                "name": desc,
                "amount": round(avg_amt, 2),
                "category": group[0].category if group[0].category in CATEGORIES else "Entertainment",
                "payment_method": group[0].payment_method or "Auto Debit",
                "frequency": "monthly",
                "occurrence_count": len(group),
                "last_charged": group[0].date.isoformat() if group[0].date else None,
            })

    return suggestions[:5]


@bp.route("", methods=["GET"])
@login_required
def list_subscriptions():
    user = _me()
    subs = db.session.scalars(
        select(Subscription)
        .where(Subscription.user_id == user.id)
        .order_by(Subscription.next_billing_date.asc())
    ).all()

    today = date.today()
    in_7_days = today + timedelta(days=7)

    total_monthly = Decimal("0")
    active_count = 0
    due_soon = []

    for s in subs:
        if s.status == "active":
            total_monthly += Decimal(str(s.monthly_cost))
            active_count += 1
            if s.next_billing_date <= in_7_days:
                due_soon.append(s.to_dict())

    existing_names = {s.name.strip().lower() for s in subs}
    suggestions = _detect_recurring_txns(user.id, existing_names)

    return jsonify({
        "subscriptions": [s.to_dict() for s in subs],
        "summary": {
            "total_monthly": float(total_monthly),
            "total_yearly": float(total_monthly * 12),
            "active_count": active_count,
            "total_count": len(subs),
            "due_soon_count": len(due_soon),
        },
        "due_soon": due_soon,
        "suggestions": suggestions,
    })


@bp.route("", methods=["POST"])
@login_required
def create_subscription():
    data = v.require_json(request)
    sub = Subscription(
        user_id=_me().id,
        name=v.text(data, "name", max_len=120),
        amount=v.amount(data, "amount"),
        category=v.choice(data, "category", CATEGORIES, default="Entertainment"),
        billing_cycle=v.choice(data, "billing_cycle", CYCLES, default="monthly"),
        next_billing_date=v.iso_date(data, "next_billing_date", required=True),
        payment_method=v.choice(data, "payment_method", PAYMENT_METHODS, required=False),
        status=v.choice(data, "status", STATUSES, default="active"),
        notes=v.text(data, "notes", required=False, max_len=500),
    )
    db.session.add(sub)
    db.session.commit()
    return jsonify(sub.to_dict()), 201


@bp.route("/<int:sub_id>", methods=["PUT"])
@login_required
def update_subscription(sub_id: int):
    sub = _owned_or_404(sub_id)
    data = v.require_json(request)

    if "name" in data:
        sub.name = v.text(data, "name", max_len=120)
    if "amount" in data:
        sub.amount = v.amount(data, "amount")
    if "category" in data:
        sub.category = v.choice(data, "category", CATEGORIES, default="Entertainment")
    if "billing_cycle" in data:
        sub.billing_cycle = v.choice(data, "billing_cycle", CYCLES, default="monthly")
    if "next_billing_date" in data:
        sub.next_billing_date = v.iso_date(data, "next_billing_date", required=True)
    if "payment_method" in data:
        sub.payment_method = v.choice(data, "payment_method", PAYMENT_METHODS, required=False)
    if "status" in data:
        sub.status = v.choice(data, "status", STATUSES, default="active")
    if "notes" in data:
        sub.notes = v.text(data, "notes", required=False, max_len=500)

    db.session.commit()
    return jsonify(sub.to_dict())


@bp.route("/<int:sub_id>", methods=["DELETE"])
@login_required
def delete_subscription(sub_id: int):
    sub = _owned_or_404(sub_id)
    db.session.delete(sub)
    db.session.commit()
    return jsonify({"success": True})


@bp.route("/<int:sub_id>/mark-paid", methods=["POST"])
@login_required
def mark_subscription_paid(sub_id: int):
    """Advance billing date to next cycle and optionally log a transaction."""
    sub = _owned_or_404(sub_id)
    data = request.get_json(silent=True) or {}
    log_txn = bool(data.get("log_transaction", True))

    created_txn = None
    if log_txn:
        created_txn = Transaction(
            user_id=_me().id,
            description=f"{sub.name} (Subscription)",
            amount=sub.amount,
            category=sub.category if sub.category in CATEGORIES else "Entertainment",
            txn_type="expense",
            date=date.today(),
            payment_method=sub.payment_method or "Auto Debit",
            notes=f"Auto-logged from subscription payment for {sub.name}.",
        )
        db.session.add(created_txn)

    # Roll forward next date
    sub.next_billing_date = _advance_date(sub.next_billing_date, sub.billing_cycle)
    db.session.commit()

    return jsonify({
        "subscription": sub.to_dict(),
        "transaction_logged": created_txn is not None,
        "transaction": created_txn.to_dict() if created_txn else None,
    })
