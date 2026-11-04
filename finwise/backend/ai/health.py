"""Financial Health Score.

A transparent, weighted rubric out of 100. Deliberately NOT a machine-learning
model: a score that changes someone's behaviour has to be explainable, and
every component here returns the exact numbers it was computed from so the UI
can show its working.

This is not a credit score and not a professional financial assessment. It is
an arithmetic summary of the user's own recorded transactions, and both this
module and the UI say so.

The weights
-----------
    Savings rate          30   how much of income is kept
    Budget discipline     20   actual spending against planned
    Spending stability    15   how much month-to-month expenses swing
    Emergency fund        15   months of expenses covered
    Income consistency    10   how reliable recorded income is
    Tracking habit        10   enough data for any of this to mean anything
                         ----
                          100

Chosen so the two things a user can act on fastest (saving more, sticking to a
budget) account for half the score, and so no single component can rescue a
bad position on its own.
"""
from __future__ import annotations

from statistics import mean, pstdev

from ai import analytics
from ai.analytics import budget_alerts, category_breakdown, filter_month, monthly_series

WEIGHTS = {
    "savings_rate": 30,
    "budget_discipline": 20,
    "spending_stability": 15,
    "emergency_fund": 15,
    "income_consistency": 10,
    "tracking_habit": 10,
}

# Below this many recorded months, the score is reported but flagged as
# provisional: two data points cannot describe a spending pattern.
MIN_MONTHS_FOR_CONFIDENCE = 3


def _band(score: float) -> str:
    if score >= 80:
        return "Excellent"
    if score >= 65:
        return "Good"
    if score >= 50:
        return "Fair"
    if score >= 35:
        return "Needs attention"
    return "At risk"


def _scale(value: float, floor: float, ceiling: float) -> float:
    """Map value onto 0..1, clamped. Linear between the two anchors."""
    if ceiling == floor:
        return 0.0
    return max(0.0, min(1.0, (value - floor) / (ceiling - floor)))


# --------------------------------------------------------------------------
# Components. Each returns (points_earned, max_points, detail_dict).
# --------------------------------------------------------------------------

def _savings_rate(series: list[dict]) -> tuple[float, int, dict]:
    """Average savings rate over the recorded months.

    0% or negative scores nothing; 30% or better scores full marks. 30% is a
    commonly cited target and is stated as the anchor rather than hidden.
    """
    maximum = WEIGHTS["savings_rate"]
    rates = [m["savings_rate"] for m in series if m["savings_rate"] is not None]
    if not rates:
        return 0.0, maximum, {
            "value": None,
            "explanation": "No month with recorded income, so a savings rate cannot be computed.",
        }

    average = round(mean(rates), 1)
    points = round(_scale(average, 0, 30) * maximum, 1)
    return points, maximum, {
        "value": average,
        "unit": "%",
        "target": 30,
        "explanation": (
            f"You kept {average}% of income on average across {len(rates)} "
            f"month(s). Full marks at 30%, none at 0% or below."
        ),
    }


def _budget_discipline(rows, budgets, current) -> tuple[float, int, dict]:
    """Share of budgets kept within their limit."""
    maximum = WEIGHTS["budget_discipline"]
    alerts = budget_alerts(rows, budgets, current)
    if not alerts:
        # No budgets set is not the same as failing them. Award the neutral
        # midpoint and say why, rather than punishing someone for not having
        # used a feature yet.
        return round(maximum * 0.5, 1), maximum, {
            "value": None,
            "explanation": (
                "No budgets set for this month, so this is scored at the neutral "
                "midpoint. Setting budgets lets it be measured properly."
            ),
            "neutral": True,
        }

    within = sum(1 for a in alerts if a["status"] != "over")
    share = within / len(alerts)
    points = round(share * maximum, 1)
    return points, maximum, {
        "value": round(share * 100, 1),
        "unit": "%",
        "explanation": (
            f"{within} of {len(alerts)} budget(s) stayed within their limit this month."
        ),
    }


def _spending_stability(series: list[dict]) -> tuple[float, int, dict]:
    """How steady monthly expenses are, as a coefficient of variation.

    Erratic spending makes planning impossible even at a decent savings rate,
    so it is scored separately. CV of 0 is perfectly steady; 0.5 or worse
    scores nothing.
    """
    maximum = WEIGHTS["spending_stability"]
    expenses = [m["expense"] for m in series if m["expense"] > 0]
    if len(expenses) < 2:
        return round(maximum * 0.5, 1), maximum, {
            "value": None,
            "explanation": "At least two months of spending are needed to judge stability.",
            "neutral": True,
        }

    average = mean(expenses)
    cv = (pstdev(expenses) / average) if average else 0.0
    points = round((1 - _scale(cv, 0, 0.5)) * maximum, 1)
    return points, maximum, {
        "value": round(cv, 3),
        "explanation": (
            f"Monthly spending varies by {round(cv * 100, 1)}% around an average "
            f"of ₹{average:,.0f}. Lower is steadier; 50% or more scores nothing."
        ),
    }


def _emergency_fund(emergency_fund, series: list[dict]) -> tuple[float, int, dict]:
    """Months of average expenses covered by the self-reported fund."""
    maximum = WEIGHTS["emergency_fund"]
    expenses = [m["expense"] for m in series if m["expense"] > 0]
    average_expense = mean(expenses) if expenses else 0.0

    if emergency_fund is None:
        return 0.0, maximum, {
            "value": None,
            "explanation": (
                "No emergency fund recorded. Add one in Settings to score this "
                "component — it is self-reported, not derived from transactions."
            ),
            "self_reported": True,
        }
    if average_expense <= 0:
        return 0.0, maximum, {
            "value": None,
            "explanation": "No recorded expenses, so months of cover cannot be computed.",
        }

    months = float(emergency_fund) / average_expense
    points = round(_scale(months, 0, 6) * maximum, 1)
    return points, maximum, {
        "value": round(months, 1),
        "unit": "months",
        "target": 6,
        "self_reported": True,
        "explanation": (
            f"₹{float(emergency_fund):,.0f} covers {months:.1f} month(s) of your "
            f"average ₹{average_expense:,.0f} spending. Full marks at 6 months."
        ),
    }


def _income_consistency(series: list[dict]) -> tuple[float, int, dict]:
    maximum = WEIGHTS["income_consistency"]
    incomes = [m["income"] for m in series if m["income"] > 0]
    if len(incomes) < 2:
        return round(maximum * 0.5, 1), maximum, {
            "value": None,
            "explanation": "At least two months with income are needed to judge consistency.",
            "neutral": True,
        }

    average = mean(incomes)
    cv = (pstdev(incomes) / average) if average else 0.0
    points = round((1 - _scale(cv, 0, 0.6)) * maximum, 1)
    return points, maximum, {
        "value": round(cv, 3),
        "explanation": (
            f"Recorded income varies by {round(cv * 100, 1)}% around ₹{average:,.0f} "
            f"a month. Irregular income is not a fault, but it does make planning harder."
        ),
    }


def _tracking_habit(rows, series: list[dict]) -> tuple[float, int, dict]:
    """Is there enough data for the rest of the score to mean anything?

    Scored explicitly rather than assumed, because every other component
    silently degrades when the user has only logged a handful of transactions.
    """
    maximum = WEIGHTS["tracking_habit"]
    months = len(series)
    count = len(rows)

    month_points = _scale(months, 0, 6) * (maximum * 0.5)
    volume_points = _scale(count, 0, 60) * (maximum * 0.5)
    points = round(month_points + volume_points, 1)

    return points, maximum, {
        "value": count,
        "months": months,
        "explanation": (
            f"{count} transaction(s) across {months} month(s). Full marks at "
            f"6 months and 60 transactions — more history makes every other "
            f"component more reliable."
        ),
    }


# --------------------------------------------------------------------------
# Public entry point
# --------------------------------------------------------------------------

LABELS = {
    "savings_rate": "Savings behaviour",
    "budget_discipline": "Budget management",
    "spending_stability": "Spending behaviour",
    "emergency_fund": "Emergency cover",
    "income_consistency": "Income consistency",
    "tracking_habit": "Financial discipline",
}


def financial_health(
    rows: list[dict],
    *,
    budgets: list[dict] | None = None,
    emergency_fund=None,
    current: str | None = None,
) -> dict:
    """Compute the score and everything needed to justify it."""
    rows = list(rows)
    series = monthly_series(rows)
    budgets = budgets or []

    # The current calendar month is only partly spent: income usually lands on
    # day 1 while rent and bills land later, so including it in an AVERAGE
    # flatters the savings rate and exaggerates the spending swing. Drop it
    # from the averaged components when enough complete months remain.
    complete = [m for m in series if not analytics.is_current_month(m["month"])]
    averaged = complete if len(complete) >= 2 else series

    if not series:
        return {
            "score": 0,
            "band": "No data",
            "provisional": True,
            "components": [],
            "strengths": [],
            "weaknesses": [],
            "warnings": [],
            "recommendations": [
                "Add your income and a few expenses to get a health score."
            ],
            "suggested_savings_target": None,
            "monthly_plan": [],
            "weights": WEIGHTS,
            "disclaimer": DISCLAIMER,
        }

    current = current or series[-1]["month"]

    results = {
        "savings_rate": _savings_rate(averaged),
        "budget_discipline": _budget_discipline(rows, budgets, current),
        "spending_stability": _spending_stability(averaged),
        "emergency_fund": _emergency_fund(emergency_fund, averaged),
        "income_consistency": _income_consistency(averaged),
        "tracking_habit": _tracking_habit(rows, series),
    }

    # Build the percentages from the typed tuples, not from the merged dicts:
    # `**detail` mixes in arbitrary keys, after which `component["pct"]` is
    # just "some value" to a reader and to a type checker alike.
    scored: list[tuple[str, float, int, dict]] = [
        (key, points, maximum, detail) for key, (points, maximum, detail) in results.items()
    ]

    components = [
        {
            "key": key,
            "label": LABELS[key],
            "points": points,
            "max_points": maximum,
            "pct": round(points / maximum * 100, 1) if maximum else 0.0,
            **detail,
        }
        for key, points, maximum, detail in scored
    ]

    score = round(sum(points for _, points, _, _ in scored))

    def _pct(points: float, maximum: int) -> float:
        return (points / maximum * 100) if maximum else 0.0

    strengths = [LABELS[key] for key, points, maximum, detail in scored
                 if _pct(points, maximum) >= 75 and not detail.get("neutral")]
    weaknesses = [LABELS[key] for key, points, maximum, detail in scored
                  if _pct(points, maximum) < 50 and not detail.get("neutral")]

    this_month = next((m for m in series if m["month"] == current), series[-1])
    warnings = _warnings(rows, series, this_month, budgets, current)

    return {
        "score": score,
        "band": _band(score),
        # Honest about how much history the score rests on.
        "provisional": len(series) < MIN_MONTHS_FOR_CONFIDENCE,
        "months_of_data": len(series),
        "components": components,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "warnings": warnings,
        "recommendations": _recommendations(components),
        "suggested_savings_target": _savings_target(this_month),
        "monthly_plan": _monthly_plan(components, this_month, rows, current),
        "weights": WEIGHTS,
        "disclaimer": DISCLAIMER,
    }


DISCLAIMER = (
    "This score is a transparent summary of the transactions you have recorded "
    "in FINWISE AI. It is not a credit score, not a professional financial "
    "assessment, and not financial advice. Every component and weight is shown "
    "so you can check the arithmetic yourself."
)


def _warnings(rows, series, this_month, budgets, current) -> list[str]:
    out = []
    if this_month["savings"] < 0:
        out.append(
            f"You spent ₹{abs(this_month['savings']):,.0f} more than you earned "
            f"in {this_month['label']}."
        )

    for alert in budget_alerts(rows, budgets, current):
        if alert["status"] == "over":
            out.append(
                f"{alert['label']} budget exceeded by ₹{abs(alert['remaining']):,.0f}."
            )

    breakdown = category_breakdown(filter_month(rows, current))
    if breakdown and breakdown[0]["share"] >= 45 and breakdown[0]["amount"] >= 500:
        top = breakdown[0]
        out.append(
            f"{top['category']} alone is {top['share']}% of this month's spending."
        )

    if len(series) < MIN_MONTHS_FOR_CONFIDENCE:
        out.append(
            f"Only {len(series)} month(s) of data — treat this score as provisional."
        )
    return out


def _recommendations(components: list[dict]) -> list[str]:
    """One concrete action per weak component, worst first."""
    weakest = sorted(
        (c for c in components if not c.get("neutral")),
        key=lambda c: c["pct"],
    )
    advice = {
        "savings_rate": (
            "Set a fixed amount to move to savings on the day you are paid, "
            "rather than saving what is left at month end."
        ),
        "budget_discipline": (
            "Set budgets for your two largest categories in Budget Planner — "
            "the score can only measure discipline against a stated plan."
        ),
        "spending_stability": (
            "Your month-to-month spending swings a lot. Look for the large "
            "one-off purchases in Transactions and plan for them in advance."
        ),
        "emergency_fund": (
            "Build towards six months of expenses in an easily accessible "
            "account, and record the balance in Settings."
        ),
        "income_consistency": (
            "Income varies month to month, so budget against your lowest "
            "recent month rather than your average."
        ),
        "tracking_habit": (
            "Keep logging transactions. Every other part of this score gets "
            "more reliable with more history."
        ),
    }
    return [advice[c["key"]] for c in weakest[:3] if c["pct"] < 75]


def _savings_target(this_month: dict) -> dict | None:
    """A target derived from this month's actual income, not a generic rule."""
    income = this_month["income"]
    if income <= 0:
        return None
    target = round(income * 0.20, 2)
    return {
        "monthly_target": target,
        "basis": "20% of this month's recorded income",
        "current_savings": this_month["savings"],
        "gap": round(target - this_month["savings"], 2),
        "achieved": this_month["savings"] >= target,
    }


def _monthly_plan(components, this_month, rows, current) -> list[dict]:
    """A short, arithmetic improvement plan.

    Each step names the number it came from. Nothing here is a projection.
    """
    plan = []
    breakdown = category_breakdown(filter_month(rows, current))

    target = _savings_target(this_month)
    if target and not target["achieved"]:
        plan.append({
            "step": "Close the savings gap",
            "detail": (
                f"Save ₹{target['gap']:,.0f} more this month to reach 20% of "
                f"your ₹{this_month['income']:,.0f} income."
            ),
        })

    discretionary = [b for b in breakdown
                     if b["category"] in {"Entertainment", "Shopping", "Food"}]
    if discretionary:
        top = max(discretionary, key=lambda b: b["amount"])
        saving = float(top["amount"]) * 0.2
        # Same floor as the insight feed: a plan step worth ₹115 is not a plan.
        # Four days into a month the largest category is still a rounding error.
        if saving >= analytics.MIN_CHANGE_RUPEES:
            count = top["transactions"]
            plan.append({
                "step": f"Trim {top['category']} by 20%",
                "detail": (
                    f"You spent ₹{top['amount']:,.0f} across {count} "
                    f"transaction{'s' if count != 1 else ''}. "
                    f"A 20% cut frees ₹{saving:,.0f}."
                ),
            })

    weakest = min((c for c in components if not c.get("neutral")),
                  key=lambda c: c["pct"], default=None)
    if weakest and weakest["pct"] < 60:
        plan.append({
            "step": f"Improve {weakest['label'].lower()}",
            "detail": weakest["explanation"],
        })

    return plan
