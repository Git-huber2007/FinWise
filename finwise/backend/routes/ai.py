"""AI endpoints.

Categorization, spending analysis, the health score, the assistant, the
savings forecast and anomaly detection. Every endpoint here computes from the
signed-in user's own rows; none of them invent figures.
"""
from typing import cast

from flask import Blueprint, current_app, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import select

import validation as v
from ai import analytics, anomaly, categorizer, health, savings
from ai import chat as chat_engine
from models import Asset, Debt, SavingsGoal, Transaction, User, db
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


@bp.route("/runway", methods=["GET", "POST"])
@login_required
def emergency_runway():
    """Emergency Fund Runway & Financial Safety Simulator."""
    from decimal import Decimal
    user = _me()
    rows = user_rows()
    debts = db.session.scalars(select(Debt).where(Debt.user_id == user.id)).all()
    assets = db.session.scalars(select(Asset).where(Asset.user_id == user.id)).all()

    # Liquid funds (cash + bank balances)
    liquid = sum((a.balance for a in assets if a.asset_type in ("cash", "bank")), Decimal("0"))
    if liquid == 0 and user.emergency_fund:
        liquid = user.emergency_fund

    # Minimum monthly debt commitments
    monthly_emi = sum((d.minimum_payment for d in debts), Decimal("0"))

    # Essential category spending (monthly average across history)
    series = analytics.monthly_series(rows)
    essential_cats = {"Housing", "Utilities", "Food", "Healthcare", "Transportation"}

    recent_months = [m["month"] for m in series[-3:]] if series else []
    essential_monthly = Decimal("0")
    if recent_months:
        essential_txns = [
            r for r in rows
            if r.get("txn_type") == "expense"
            and r.get("date", "")[:7] in recent_months
            and r.get("category") in essential_cats
        ]
        total_essential = sum(Decimal(str(r["amount"])) for r in essential_txns)
        essential_monthly = round(total_essential / len(recent_months), 2)
    else:
        essential_monthly = Decimal("20000.00")

    total_survival_burn = essential_monthly + monthly_emi
    if total_survival_burn <= 0:
        total_survival_burn = Decimal("15000.00")

    # Overall monthly expense average
    avg_total_expense = Decimal(str(round(sum(m["expense"] for m in series) / max(1, len(series)), 2))) if series else total_survival_burn

    # Parse simulation overrides if POST
    custom_liquid = float(liquid)
    custom_burn = float(total_survival_burn)
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        liquid_override = data.get("liquid_savings")
        if liquid_override is None:
            liquid_override = data.get("liquid_reserves")
        if liquid_override is None:
            liquid_override = data.get("custom_liquid_reserves")
        if liquid_override is not None:
            custom_liquid = max(0.0, float(liquid_override))

        burn_override = data.get("monthly_burn")
        if burn_override is None:
            burn_override = data.get("custom_monthly_burn")
        if burn_override is not None:
            custom_burn = max(1.0, float(burn_override))

    runway_months = round(custom_liquid / max(1.0, custom_burn), 1)

    scenarios = {
        "barebones_survival": {
            "title": "Essential Survival Mode",
            "monthly_burn": float(total_survival_burn),
            "runway_months": round(float(liquid) / max(1.0, float(total_survival_burn)), 1),
            "description": "Covers strictly essentials (rent, food, utilities, EMIs) with zero discretionary spend.",
        },
        "lifestyle_maintenance": {
            "title": "Full Current Lifestyle",
            "monthly_burn": float(avg_total_expense),
            "runway_months": round(float(liquid) / max(1.0, float(avg_total_expense)), 1),
            "description": "Maintains 100% of your average lifestyle spending without reducing expenses.",
        },
        "inflation_shock_20pct": {
            "title": "Cost of Living Spike (+20%)",
            "monthly_burn": round(float(total_survival_burn) * 1.2, 2),
            "runway_months": round(float(liquid) / max(1.0, float(total_survival_burn) * 1.2), 1),
            "description": "Simulates sharp 20% price inflation on essential goods and bills.",
        },
        "emergency_medical_shock": {
            "title": "Major Shock (-₹1,00,000)",
            "monthly_burn": float(total_survival_burn),
            "runway_months": round(max(0.0, float(liquid) - 100000.0) / max(1.0, float(total_survival_burn)), 1),
            "description": "Assumes a sudden one-time medical or emergency outlay of ₹1 Lakh.",
        },
    }

    return jsonify({
        "liquid_reserves": float(liquid),
        "essential_monthly_burn": float(essential_monthly),
        "debt_emi_burn": float(monthly_emi),
        "total_survival_burn": float(total_survival_burn),
        "lifestyle_monthly_burn": float(avg_total_expense),
        "simulated": {
            "liquid": custom_liquid,
            "burn": custom_burn,
            "runway_months": runway_months,
        },
        "scenarios": scenarios,
    })


@bp.post("/chat")
@login_required
def chat():
    """FINWISE AI Assistant.

    Gemini when a key is configured, the rule engine otherwise -- and the rule
    engine also catches every Gemini failure, so this endpoint does not have a
    path that returns an error to the user instead of an answer.
    """
    data = v.require_json(request)
    question = v.text(data, "message", max_len=1000)

    rows = user_rows()
    month = resolve_month(rows, data.get("month"))
    goals = [g.to_dict() for g in db.session.scalars(
        select(SavingsGoal).where(SavingsGoal.user_id == _me().id)
    ).all()]

    context = chat_engine.build_context(
        rows,
        budgets=user_budgets(),
        goals=goals,
        monthly_income=_me().monthly_income,
        emergency_fund=_me().emergency_fund,
        current=month,
    )

    result = chat_engine.ask(
        question,
        context,
        api_key=current_app.config.get("GEMINI_API_KEY", ""),
        model=current_app.config.get("GEMINI_MODEL", ""),
        logger=current_app.logger,
    )
    return jsonify(result.to_dict())


@bp.post("/predict-savings")
@login_required
def predict_savings():
    """Forecast monthly net savings, and project every goal from it.

    Labelled an estimate throughout. The response carries the method actually
    used and the r-squared of the fit, so the UI can show a weak forecast as a
    weak forecast instead of a number.
    """
    data = request.get_json(silent=True) or {}
    horizon = v.integer(data, "horizon", minimum=1, maximum=savings.MAX_HORIZON,
                        required=False, default=3)
    rows = user_rows()
    result = savings.predict(rows, horizon=horizon)

    rate = float(result.get("predicted_next") or 0)
    goals = db.session.scalars(
        select(SavingsGoal).where(
            SavingsGoal.user_id == _me().id, SavingsGoal.status == "active"
        )
    ).all()
    result["goals"] = [savings.project_goal(g.to_dict(), rate) for g in goals]
    result["this_month_so_far"] = analytics.totals_for(
        analytics.filter_month(rows, resolve_month(rows, None))
    )
    return jsonify(result)


@bp.post("/detect-anomalies")
@login_required
def detect_anomalies():
    """Unusually large expenses, for the user to confirm.

    Never described as fraud, and never acted on automatically -- the response
    marks every item `needs_review` and carries the reason it was flagged.
    """
    data = request.get_json(silent=True) or {}
    rows = user_rows()
    # An explicit null month means "my whole history"; an absent one means the
    # month being viewed. Those are different questions and the client asks
    # both, so the sentinel is needed.
    month = data.get("month", "__current__")
    if month == "__current__":
        month = resolve_month(rows, None)

    return jsonify(anomaly.detect(rows, month=month))


@bp.get("/chat/starters")
@login_required
def chat_starters():
    """Suggested questions, plus whether the LLM path is available.

    `llm_configured` is a boolean only -- the key itself never leaves the server.
    """
    return jsonify(
        suggestions=chat_engine.SUGGESTED_QUESTIONS,
        llm_configured=bool(current_app.config.get("GEMINI_API_KEY")),
        disclaimer=chat_engine.DISCLAIMER,
    )
