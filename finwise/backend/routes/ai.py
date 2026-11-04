"""AI endpoints.

Phases 5-6 ship categorization, spending analysis and the health score. The
chat / predict-savings / detect-anomalies endpoints land in phases 7-8.
"""
from typing import cast

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import select

import validation as v
from ai import analytics, categorizer, health
from models import Transaction, User, db
from routes.dashboard import resolve_month, user_budgets, user_rows

bp = Blueprint("ai", __name__, url_prefix="/api/ai")

# A user needs at least this many corrections before retraining on them.
# One correction is as likely to be a typo as a preference.
MIN_CORRECTIONS_TO_RETRAIN = 3


def _me() -> User:
    return cast(User, current_user)


@bp.post("/categorize")
@login_required
def categorize():
    """Predict a category for a transaction description.

    Returns the prediction plus runner-up categories and an explicit
    `confident` flag, so the UI can show a weak guess as a suggestion rather
    than as an answer.
    """
    data = v.require_json(request)
    description = v.text(data, "description", max_len=255)
    result = categorizer.predict(description)

    payload = result.to_dict()
    payload["description"] = description
    return jsonify(payload)


@bp.get("/categorize/stats")
@login_required
def categorize_stats():
    """How the model is performing, and how much this user has corrected it.

    Exposed so the UI can be honest about model quality instead of presenting
    predictions as authoritative.
    """
    corrections = db.session.scalar(
        select(db.func.count(Transaction.id)).where(
            Transaction.user_id == _me().id, Transaction.was_corrected.is_(True)
        )
    ) or 0
    predicted = db.session.scalar(
        select(db.func.count(Transaction.id)).where(
            Transaction.user_id == _me().id, Transaction.ai_category.is_not(None)
        )
    ) or 0

    return jsonify(
        corrections=corrections,
        predicted=predicted,
        # Share of predictions this user accepted. None when nothing has been
        # predicted yet -- 100% on a sample of zero would be a lie.
        acceptance_rate=(round((predicted - corrections) / predicted, 3)
                         if predicted else None),
        retrain_available=corrections >= MIN_CORRECTIONS_TO_RETRAIN,
        min_corrections=MIN_CORRECTIONS_TO_RETRAIN,
    )


@bp.post("/categorize/retrain")
@login_required
def retrain():
    """Refit the model on the seed corpus plus this user's corrections.

    Corrections are appended to the seed data, never substituted for it: a
    handful of overrides should nudge the model, not erase what it knows.
    """
    rows = db.session.scalars(
        select(Transaction).where(
            Transaction.user_id == _me().id, Transaction.was_corrected.is_(True)
        )
    ).all()

    corrections = [(t.description, t.category) for t in rows if t.description and t.category]

    if len(corrections) < MIN_CORRECTIONS_TO_RETRAIN:
        return jsonify(
            error=(f"Need at least {MIN_CORRECTIONS_TO_RETRAIN} corrected transactions "
                   f"to retrain; you have {len(corrections)}."),
            corrections=len(corrections),
        ), 400

    categorizer.retrain(extra=corrections)
    return jsonify(ok=True, trained_on_corrections=len(corrections))


@bp.get("/model-info")
@login_required
def model_info():
    """Measured model quality. Both metrics, never just the flattering one."""
    return jsonify(
        model="TF-IDF (word 1-2 grams + char_wb 3-5 grams) -> ComplementNB",
        holdout=categorizer.evaluate(),
        realistic=categorizer.evaluate_realistic(),
        confidence_floor=categorizer.CONFIDENCE_FLOOR,
        note=(
            "Held-out accuracy splits the training corpus, so it measures "
            "classifying an unseen merchant - the hardest case. The realistic "
            "figure uses full sentences containing known merchants. Both were "
            "authored by the same developer, so treat them as a bracket, not "
            "as an independent benchmark."
        ),
    )


@bp.post("/analyze")
@login_required
def analyze():
    """Spending analysis for a month: totals, categories, movement, insights.

    Every figure is computed from the user's own rows. Nothing here is
    generated text -- the insight strings are templates filled with numbers
    the user could recompute by hand.
    """
    data = request.get_json(silent=True) or {}
    rows = user_rows()
    budgets = user_budgets()
    month = resolve_month(rows, data.get("month"))

    series = analytics.monthly_series(rows)
    index = next((i for i, m in enumerate(series) if m["month"] == month), None)
    previous = series[index - 1]["month"] if index not in (None, 0) else None
    month_rows = analytics.filter_month(rows, month)

    return jsonify(
        month=month,
        month_label=analytics.month_label(month),
        totals=analytics.totals_for(month_rows),
        monthly_series=series,
        category_breakdown=analytics.category_breakdown(month_rows),
        comparison=analytics.month_over_month(rows, month, previous) if previous else [],
        previous_month=previous,
        budget_alerts=analytics.budget_alerts(rows, budgets, month),
        insights=analytics.generate_insights(rows, current=month, budgets=budgets, limit=10),
        has_data=bool(rows),
    )


@bp.post("/financial-health")
@login_required
def financial_health():
    """The Financial Health Checkup.

    Returns the score together with every component, weight and the numbers
    each was computed from, so the UI can show its working rather than
    presenting a number to be taken on trust.
    """
    data = request.get_json(silent=True) or {}
    rows = user_rows()
    budgets = user_budgets()
    month = resolve_month(rows, data.get("month"))

    result = health.financial_health(
        rows, budgets=budgets, emergency_fund=_me().emergency_fund, current=month
    )
    result["month"] = month
    result["month_label"] = analytics.month_label(month)
    return jsonify(result)
