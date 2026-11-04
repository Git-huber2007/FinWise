"""Budget CRUD and utilisation.

Budgets are per category per month, with `category IS NULL` meaning the overall
monthly budget. The reading side of this (alerts, the health score's budget
discipline component, the report's budget table) was built in earlier phases
against `analytics.budget_alerts`; this module is the writing side, and reuses
that same function so the page a user edits on shows the same figures as every
other surface.

Authorization follows every other blueprint: statements filter on
`Budget.user_id == current_user.id`, so another user's budget does not exist
rather than being forbidden.
"""
from datetime import date
from typing import cast

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import select
from werkzeug.exceptions import NotFound

import validation as v
from ai import analytics
from constants import CATEGORIES
from models import Budget, User, db
from routes.dashboard import resolve_month, user_rows

bp = Blueprint("budgets", __name__, url_prefix="/api/budgets")

# Categories a budget can be set for. Only Salary is excluded: budgeting your
# own salary is not a thing, and offering it invites a row stuck at 0% used
# forever.
#
# Investments is deliberately INCLUDED even though it is an income category
# elsewhere, because it is genuinely both: a dividend is income, a monthly SIP
# is an expense, and the seed data records SIPs as expenses. Excluding it put
# "Investments Rs. 5,000 this month -- Set a budget" in the unbudgeted list
# with a button that opened a form the API then rejected with a 400.
BUDGETABLE = [c for c in CATEGORIES if c != "Salary"]

# How many months of history to average when suggesting an amount.
SUGGESTION_MONTHS = 6


def _me() -> User:
    return cast(User, current_user)


def _owned_or_404(budget_id: int) -> Budget:
    budget = db.session.scalar(
        select(Budget).where(Budget.id == budget_id, Budget.user_id == _me().id)
    )
    if budget is None:
        raise NotFound("Budget not found.")
    return budget


def _a(label: str) -> str:
    """"A" or "An". Every category is consonant-initial except the overall
    budget's own label, which read "A overall budget already exists"."""
    return "An" if label[:1].lower() in "aeiou" else "A"


def _split(month_key: str) -> tuple[int, int]:
    year, month = (int(part) for part in month_key.split("-"))
    return year, month


def _existing(category: str | None, year: int, month: int, *, exclude: int | None = None):
    """Find a budget for the same slot.

    Done with an explicit query rather than relying on the unique index,
    because SQLite (and the SQL standard) treats NULLs as distinct: the index
    on (user_id, category, month, year) does NOT prevent two overall budgets,
    whose category is NULL. The models.py constraint carries a note pointing
    here.
    """
    conditions = [
        Budget.user_id == _me().id,
        Budget.year == year,
        Budget.month == month,
        Budget.category.is_(None) if category is None else Budget.category == category,
    ]
    if exclude is not None:
        conditions.append(Budget.id != exclude)
    return db.session.scalar(select(Budget).where(*conditions))


def _typical_spend(rows: list[dict], upto_month: str) -> dict[str, float]:
    """Average monthly spend per category over recent COMPLETE months.

    Offered as a starting point when setting a budget. Complete months only,
    for the same reason the savings forecast excludes the current one: a month
    that is four days old would suggest a budget a fifth of the right size.
    """
    months = [m["month"] for m in analytics.monthly_series(rows)
              if m["month"] < upto_month][-SUGGESTION_MONTHS:]
    if not months:
        return {}

    totals: dict[str, float] = {}
    for key in months:
        for item in analytics.category_breakdown(analytics.filter_month(rows, key)):
            totals[item["category"]] = totals.get(item["category"], 0.0) + item["amount"]
    return {category: round(total / len(months), 2) for category, total in totals.items()}


@bp.get("")
@login_required
def list_budgets():
    """Budgets for a month, with what has actually been spent against each."""
    rows = user_rows()
    month_key = resolve_month(rows, request.args.get("month"))
    year, month = _split(month_key)

    budgets = db.session.scalars(
        select(Budget).where(
            Budget.user_id == _me().id, Budget.year == year, Budget.month == month
        )
    ).all()

    # The same function the dashboard, health score and PDF use. Recomputing
    # utilisation here would be a second source of truth for the one number
    # this page exists to show.
    alerts = analytics.budget_alerts(rows, [b.to_dict() for b in budgets], month_key)
    by_category = {alert["category"]: alert for alert in alerts}

    merged = []
    for budget in budgets:
        payload = budget.to_dict()
        payload.update(by_category.get(budget.category, {}))
        merged.append(payload)
    # Overall first, then biggest spender down.
    merged.sort(key=lambda b: (not b["is_overall"], -(b.get("spent") or 0)))

    month_rows = analytics.filter_month(rows, month_key)
    spent_by_category = {item["category"]: item["amount"]
                         for item in analytics.category_breakdown(month_rows)}
    budgeted = {b.category for b in budgets if b.category}
    overall = next((b for b in merged if b["is_overall"]), None)
    per_category = [b for b in merged if not b["is_overall"]]

    return jsonify(
        month=month_key,
        month_label=analytics.month_label(month_key),
        partial_month=analytics.is_current_month(month_key),
        budgets=merged,
        overall=overall,
        totals={
            "budgeted": round(sum(b["amount"] for b in per_category), 2),
            "spent": round(sum(spent_by_category.values()), 2),
            "over_count": sum(1 for b in merged if b.get("status") == "over"),
            "warning_count": sum(1 for b in merged if b.get("status") == "warning"),
        },
        # Spending the user has not budgeted for, so the page can say what is
        # missing instead of implying the budgeted categories are everything.
        # Restricted to budgetable categories so the "Set a budget" button
        # beside each one cannot open a form the API will refuse.
        unbudgeted=sorted(
            ({"category": category, "spent": amount}
             for category, amount in spent_by_category.items()
             if category not in budgeted and category in BUDGETABLE),
            key=lambda item: item["spent"], reverse=True,
        ),
        available_categories=[c for c in BUDGETABLE if c not in budgeted],
        has_overall=overall is not None,
        typical=_typical_spend(rows, month_key),
        warn_at_pct=analytics.WARN_AT_PCT,
    )


def _month_fields(data: dict) -> tuple[int, int]:
    """Read the target period, defaulting to the current month."""
    today = date.today()
    year = v.integer(data, "year", minimum=2000, maximum=2100,
                     required=False, default=today.year)
    month = v.integer(data, "month", minimum=1, maximum=12,
                      required=False, default=today.month)
    return int(year), int(month)


@bp.post("")
@login_required
def create_budget():
    data = v.require_json(request)
    year, month = _month_fields(data)

    # An absent or null category means the overall budget, which is a real
    # choice rather than a missing field.
    raw_category = data.get("category")
    category = None if raw_category in (None, "", "overall") else v.category(data)
    if category is not None and category not in BUDGETABLE:
        return jsonify(error=f"{category} cannot be budgeted.", field="category"), 400

    if _existing(category, year, month):
        label = category or "overall"
        return jsonify(
            error=f"{_a(label)} {label} budget already exists for that month. "
                  f"Edit it instead.",
            field="category",
        ), 409

    budget = Budget(user_id=_me().id, category=category,
                    amount=v.amount(data), month=month, year=year)
    db.session.add(budget)
    db.session.commit()
    return jsonify(budget.to_dict()), 201


@bp.put("/<int:budget_id>")
@login_required
def update_budget(budget_id: int):
    budget = _owned_or_404(budget_id)
    data = v.require_json(request)

    if "amount" in data:
        budget.amount = v.amount(data)
    if "category" in data:
        raw = data.get("category")
        category = None if raw in (None, "", "overall") else v.category(data)
        if category is not None and category not in BUDGETABLE:
            return jsonify(error=f"{category} cannot be budgeted.", field="category"), 400
        if _existing(category, budget.year, budget.month, exclude=budget.id):
            label = category or "overall"
            return jsonify(error=f"{_a(label)} {label} budget already exists "
                                 f"for that month.", field="category"), 409
        budget.category = category

    db.session.commit()
    return jsonify(budget.to_dict())


@bp.delete("/<int:budget_id>")
@login_required
def delete_budget(budget_id: int):
    budget = _owned_or_404(budget_id)
    db.session.delete(budget)
    db.session.commit()
    return jsonify(ok=True, deleted_id=budget_id)
