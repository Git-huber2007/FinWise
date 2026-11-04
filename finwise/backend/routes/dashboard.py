"""Dashboard aggregate.

One endpoint fills every tile and every chart. Deliberately one call rather
than six: the figures must be internally consistent, and six round trips can
interleave with a transaction being added and show totals that do not add up.
"""
from datetime import date
from typing import cast

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import select

from ai import analytics, health
from models import Budget, Transaction, User, db

bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


def _me() -> User:
    return cast(User, current_user)


def user_rows() -> list[dict]:
    """Every transaction for the signed-in user, as plain dicts.

    The ai/* modules take plain data so they stay testable without a database;
    this is the single place that conversion happens.
    """
    rows = db.session.scalars(
        select(Transaction)
        .where(Transaction.user_id == _me().id)
        .order_by(Transaction.date)
    ).all()
    return [r.to_dict() for r in rows]


def user_budgets() -> list[dict]:
    rows = db.session.scalars(
        select(Budget).where(Budget.user_id == _me().id)
    ).all()
    return [b.to_dict() for b in rows]


def resolve_month(rows: list[dict], requested: str | None) -> str:
    """Pick the month to report on.

    Defaults to the current calendar month so the dashboard matches what the
    user expects to see, but falls back to the most recent month that actually
    has data -- otherwise a demo dataset ending last month shows an empty
    dashboard and looks broken.
    """
    if requested:
        return requested
    today = f"{date.today():%Y-%m}"
    months = {analytics.month_key(r["date"]) for r in rows}
    return today if today in months or not months else max(m for m in months if m)


@bp.get("")
@login_required
def dashboard():
    rows = user_rows()
    budgets = user_budgets()
    month = resolve_month(rows, request.args.get("month"))

    series = analytics.monthly_series(rows)
    this_month_rows = analytics.filter_month(rows, month)
    totals = analytics.totals_for(this_month_rows)

    index = next((i for i, m in enumerate(series) if m["month"] == month), None)
    previous = series[index - 1] if index not in (None, 0) else None

    score = health.financial_health(
        rows, budgets=budgets, emergency_fund=_me().emergency_fund, current=month
    )

    alerts = analytics.budget_alerts(rows, budgets, month)
    overall = next((a for a in alerts if a["category"] is None), None)

    recent = sorted(this_month_rows or rows,
                    key=lambda r: (r["date"], r["id"]), reverse=True)[:8]

    return jsonify(
        month=month,
        month_label=analytics.month_label(month),
        # --- the ten headline tiles ---
        totals=totals,
        previous=({"income": previous["income"], "expense": previous["expense"],
                   "savings": previous["savings"]} if previous else None),
        budget={
            "limit": overall["budget"] if overall else None,
            "spent": overall["spent"] if overall else totals["expense"],
            "remaining": overall["remaining"] if overall else None,
            "used_pct": overall["used_pct"] if overall else None,
        },
        health_score=score["score"],
        health_band=score["band"],
        health_provisional=score["provisional"],
        # --- chart data ---
        monthly_series=series[-12:],
        category_breakdown=analytics.category_breakdown(this_month_rows),
        comparison=(analytics.month_over_month(rows, month, previous["month"])[:6]
                    if previous else []),
        budget_alerts=alerts,
        # --- feed ---
        recent_transactions=recent,
        insights=analytics.generate_insights(rows, current=month, budgets=budgets, limit=5),
        has_data=bool(rows),
    )
