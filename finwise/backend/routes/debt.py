"""Debt Payoff & EMI Acceleration Planner (Snowball vs. Avalanche).

Calculates payoff timelines, interest savings, and debt-free dates under
Debt Avalanche (highest interest first) and Debt Snowball (smallest balance first).
"""
import copy
from datetime import datetime, timezone
from decimal import Decimal
from typing import cast

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import select
from werkzeug.exceptions import NotFound

import validation as v
from models import Debt, User, db

bp = Blueprint("debt", __name__, url_prefix="/api/debt")

DEBT_TYPES = ["credit_card", "home_loan", "personal_loan", "auto_loan", "education_loan", "other"]


def _me() -> User:
    return cast(User, current_user)


def _owned_debt_or_404(debt_id: int) -> Debt:
    debt = db.session.scalar(
        select(Debt).where(Debt.id == debt_id, Debt.user_id == _me().id)
    )
    if debt is None:
        raise NotFound("Debt record not found.")
    return debt


def _simulate_payoff(debts_raw: list[dict], extra_monthly: float, strategy: str = "avalanche") -> dict:
    """Simulate debt payoff month by month using amortized interest."""
    if not debts_raw:
        return {"months": 0, "total_interest": 0.0, "total_paid": 0.0, "schedule": []}

    # Clone debts
    debts = copy.deepcopy(debts_raw)
    # Sort order
    if strategy == "avalanche":
        debts.sort(key=lambda d: d["interest_rate"], reverse=True)
    else:  # snowball
        debts.sort(key=lambda d: d["current_balance"])

    total_interest = 0.0
    total_paid = 0.0
    months = 0
    max_months = 360  # 30-year safety ceiling

    total_initial_balance = sum(d["current_balance"] for d in debts)

    while any(d["current_balance"] > 0 for d in debts) and months < max_months:
        months += 1
        available_extra = extra_monthly

        # 1. Accrue monthly interest on remaining balances and pay minimums
        for d in debts:
            if d["current_balance"] <= 0:
                continue
            monthly_rate = (d["interest_rate"] / 100.0) / 12.0
            interest = d["current_balance"] * monthly_rate
            total_interest += interest
            d["current_balance"] += interest

            # Pay minimum
            pay = min(d["current_balance"], d["minimum_payment"])
            d["current_balance"] -= pay
            total_paid += pay

            # If minimum was more than needed, surplus goes to extra pool
            if d["minimum_payment"] > pay:
                available_extra += (d["minimum_payment"] - pay)

        # 2. Apply available extra payment to priority debt
        for d in debts:
            if d["current_balance"] <= 0 or available_extra <= 0:
                continue
            extra_pay = min(d["current_balance"], available_extra)
            d["current_balance"] -= extra_pay
            total_paid += extra_pay
            available_extra -= extra_pay
            if d["current_balance"] <= 0:
                # Snowball rollover: freed up minimum payment joins extra pool for next month
                extra_monthly += d["minimum_payment"]

    return {
        "strategy": strategy,
        "months": months,
        "years": round(months / 12.0, 1),
        "total_interest": round(total_interest, 2),
        "total_paid": round(total_paid, 2),
        "initial_debt": round(total_initial_balance, 2),
    }


@bp.route("", methods=["GET"])
@login_required
def list_debts():
    user = _me()
    debts = db.session.scalars(
        select(Debt).where(Debt.user_id == user.id).order_by(Debt.interest_rate.desc())
    ).all()

    total_debt = sum((d.current_balance for d in debts), Decimal("0"))
    total_min_monthly = sum((d.minimum_payment for d in debts), Decimal("0"))

    # Weighted average interest rate
    avg_interest = 0.0
    if total_debt > 0:
        avg_interest = sum(float(d.current_balance) * float(d.interest_rate) for d in debts) / float(total_debt)

    debts_dicts = [d.to_dict() for d in debts]

    # Read extra_monthly parameter if provided
    extra_str = request.args.get("extra_monthly", "0")
    try:
        extra_monthly = max(0.0, float(extra_str))
    except ValueError:
        extra_monthly = 0.0

    # Simulations: baseline vs accelerated
    baseline_sim = _simulate_payoff(debts_dicts, extra_monthly=0.0, strategy="avalanche")
    avalanche_sim = _simulate_payoff(debts_dicts, extra_monthly=extra_monthly, strategy="avalanche")
    snowball_sim = _simulate_payoff(debts_dicts, extra_monthly=extra_monthly, strategy="snowball")

    # Savings calculation
    interest_saved_avalanche = max(0.0, baseline_sim["total_interest"] - avalanche_sim["total_interest"])
    months_saved_avalanche = max(0, baseline_sim["months"] - avalanche_sim["months"])

    return jsonify({
        "debts": debts_dicts,
        "summary": {
            "total_debt": float(total_debt),
            "total_monthly_emi": float(total_min_monthly),
            "average_interest_rate": round(avg_interest, 2),
            "debt_count": len(debts),
        },
        "simulation": {
            "extra_monthly": extra_monthly,
            "baseline": baseline_sim,
            "avalanche": avalanche_sim,
            "snowball": snowball_sim,
            "interest_saved": round(interest_saved_avalanche, 2),
            "months_saved": months_saved_avalanche,
        },
    })


@bp.route("", methods=["POST"])
@login_required
def create_debt():
    data = v.require_json(request)
    current_bal = v.amount(data, "current_balance", required=True)
    principal = v.amount(data, "principal_amount", required=False) or current_bal

    try:
        interest_rate = float(data.get("interest_rate", 0.0))
        if interest_rate < 0 or interest_rate > 100:
            raise ValueError()
    except (TypeError, ValueError):
        raise v.ValidationError("Interest rate must be a percentage between 0 and 100.", "interest_rate")

    min_pay = v.amount(data, "minimum_payment", required=True)

    due_day = None
    if data.get("due_day"):
        try:
            due_day = int(data["due_day"])
            if not 1 <= due_day <= 31:
                raise ValueError()
        except (ValueError, TypeError):
            raise v.ValidationError("Due day must be between 1 and 31.", "due_day")

    debt = Debt(
        user_id=_me().id,
        name=v.text(data, "name", max_len=120),
        debt_type=v.choice(data, "debt_type", DEBT_TYPES, default="credit_card"),
        principal_amount=principal,
        current_balance=current_bal,
        interest_rate=interest_rate,
        minimum_payment=min_pay,
        due_day=due_day,
        institution=v.text(data, "institution", required=False, max_len=80),
        notes=v.text(data, "notes", required=False, max_len=500),
    )
    db.session.add(debt)
    db.session.commit()
    return jsonify(debt.to_dict()), 201


@bp.route("/<int:debt_id>", methods=["PUT"])
@login_required
def update_debt(debt_id: int):
    debt = _owned_debt_or_404(debt_id)
    data = v.require_json(request)

    if "name" in data:
        debt.name = v.text(data, "name", max_len=120)
    if "debt_type" in data:
        debt.debt_type = v.choice(data, "debt_type", DEBT_TYPES, default="credit_card")
    if "current_balance" in data:
        debt.current_balance = v.amount(data, "current_balance", required=True)
    if "principal_amount" in data:
        debt.principal_amount = v.amount(data, "principal_amount", required=True)
    if "interest_rate" in data:
        try:
            rate = float(data["interest_rate"])
            if rate < 0 or rate > 100:
                raise ValueError()
            debt.interest_rate = rate
        except (ValueError, TypeError):
            raise v.ValidationError("Interest rate must be between 0 and 100.", "interest_rate")
    if "minimum_payment" in data:
        debt.minimum_payment = v.amount(data, "minimum_payment", required=True)
    if "due_day" in data:
        if data["due_day"]:
            due = int(data["due_day"])
            if not 1 <= due <= 31:
                raise v.ValidationError("Due day must be between 1 and 31.", "due_day")
            debt.due_day = due
        else:
            debt.due_day = None
    if "institution" in data:
        debt.institution = v.text(data, "institution", required=False, max_len=80)
    if "notes" in data:
        debt.notes = v.text(data, "notes", required=False, max_len=500)
    debt.updated_at = datetime.now(timezone.utc)

    db.session.commit()
    return jsonify(debt.to_dict())


@bp.route("/<int:debt_id>", methods=["DELETE"])
@login_required
def delete_debt(debt_id: int):
    debt = _owned_debt_or_404(debt_id)
    db.session.delete(debt)
    db.session.commit()
    return jsonify({"success": True})

