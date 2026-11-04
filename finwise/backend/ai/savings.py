"""Savings prediction.

A linear trend fitted to the user's own monthly net savings, plus the arithmetic
that turns a monthly figure into a goal completion date.

Two rules shape everything here:

* **Only complete months are fitted.** The current month is a partial sample --
  on the 4th it holds the salary but not the rent, or the rent but not the
  salary. Feeding it to the regression tilts the whole line on an accident of
  the calendar. It is reported separately as "so far this month" instead.
* **Nothing is guaranteed.** Every number this module returns is labelled an
  estimate and carries the sample size it came from, because a forecast from
  three months of data is a guess with arithmetic attached and the UI has to be
  able to say so.
"""
from __future__ import annotations

from datetime import date
from statistics import mean, pstdev

from ai.analytics import is_current_month, month_label, monthly_series

# Below this many complete months a straight line through the points is
# meaningless -- two points define a line exactly and predict nothing. Under
# the floor we fall back to the average, and say which method was used.
MIN_MONTHS_FOR_TREND = 4

# Averaging needs less data than fitting, but not none.
MIN_MONTHS_FOR_AVERAGE = 2

# How much of the month-to-month variation the fitted line has to account for
# before we are willing to project it forward. Added after the demo data
# produced an r2 of 0.028 and a forecast that still announced savings were
# "rising by about 1,483 rupees a month" -- a slope through noise, stated with
# a confidence the arithmetic did not support. Below this floor the line is
# discarded for the average, and the user is told why.
MIN_R2_FOR_TREND = 0.3

# How far ahead we are willing to project. Beyond half a year, a line fitted to
# a handful of months is arithmetic theatre.
MAX_HORIZON = 6

DISCLAIMER = (
    "These figures are estimates calculated from your own recorded "
    "transactions. They are not a guarantee of future income, spending or "
    "returns."
)


def complete_months(rows) -> list[dict]:
    """The monthly series with any in-progress month removed."""
    return [m for m in monthly_series(rows) if not is_current_month(m["month"])]


def _fit_line(values: list[float]) -> tuple[float, float, float]:
    """Least-squares fit of `values` against 0, 1, 2, ... -> slope, intercept, r2.

    scikit-learn is already a dependency and ``LinearRegression`` is the obvious
    tool, but on a single feature it is a wrapper around exactly this closed
    form -- importing it here would cost a model object and a numpy round-trip
    to compute three numbers. The seam is kept narrow (one function, one test)
    so swapping it later is trivial.
    """
    n = len(values)
    xs = list(range(n))
    mean_x, mean_y = mean(xs), mean(values)
    var_x = sum((x - mean_x) ** 2 for x in xs)
    if var_x == 0:
        return 0.0, mean_y, 0.0
    slope = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, values)) / var_x
    intercept = mean_y - slope * mean_x

    # Coefficient of determination. A perfectly flat series has no variance to
    # explain, so r2 is undefined rather than perfect -- reported as 0.0, which
    # is the honest direction to round it.
    ss_total = sum((y - mean_y) ** 2 for y in values)
    if ss_total == 0:
        return slope, intercept, 0.0
    ss_residual = sum((y - (intercept + slope * x)) ** 2 for x, y in zip(xs, values))
    return slope, intercept, max(0.0, 1 - ss_residual / ss_total)


def _next_months(last_key: str, count: int) -> list[str]:
    year, month = (int(part) for part in last_key.split("-"))
    out = []
    for _ in range(count):
        month += 1
        if month > 12:
            year, month = year + 1, 1
        out.append(f"{year:04d}-{month:02d}")
    return out


def predict(rows, *, horizon: int = 3) -> dict:
    """Forecast monthly net savings.

    Returns the method actually used, so a two-month average is never presented
    with the authority of a fitted trend.
    """
    horizon = max(1, min(horizon, MAX_HORIZON))
    history = complete_months(rows)
    savings = [float(m["savings"]) for m in history]

    result: dict = {
        "disclaimer": DISCLAIMER,
        "months_of_history": len(history),
        "history": history[-12:],
        "horizon": horizon,
    }

    if len(history) < MIN_MONTHS_FOR_AVERAGE:
        result.update(
            method="insufficient_data",
            method_label="Not enough history yet",
            predictions=[],
            average_savings=round(savings[0], 2) if savings else 0.0,
            confidence="none",
            explanation=(
                f"A forecast needs at least {MIN_MONTHS_FOR_AVERAGE} complete months "
                f"of transactions. You have {len(history)}."
            ),
        )
        return result

    average = mean(savings)
    slope, r2 = 0.0, 0.0
    fitted_r2 = None

    if len(history) >= MIN_MONTHS_FOR_TREND:
        slope, intercept, fitted_r2 = _fit_line(savings)
        if fitted_r2 >= MIN_R2_FOR_TREND:
            r2 = fitted_r2
            values = [intercept + slope * (len(savings) - 1 + step)
                      for step in range(1, horizon + 1)]
            method, label = "linear_trend", "Linear trend over your complete months"
            # r2 is how much of the variation the line actually accounts for.
            # It is the only defensible basis for a confidence word, so it is
            # the one used.
            confidence = "moderate" if fitted_r2 >= 0.5 else "low"
            direction = "rising" if slope > 50 else "falling" if slope < -50 else "broadly flat"
            explanation = (
                f"Fitted to {len(history)} complete months. Your net savings are "
                f"{direction} by about {abs(slope):,.0f} rupees a month, and the line "
                f"explains {fitted_r2 * 100:.0f}% of the variation between months."
            )
        else:
            # The fit exists but does not describe the data. Reporting its
            # slope would invent a trend out of noise.
            slope = 0.0
            values = [average] * horizon
            method, label = "average", "Average of your complete months"
            confidence = "low"
            explanation = (
                f"Your monthly savings vary too much for a straight line to describe "
                f"them -- the best fit over your {len(history)} complete months explains "
                f"only {fitted_r2 * 100:.0f}% of the month-to-month variation. Rather "
                f"than project a trend that is not there, this is your average monthly "
                f"saving carried forward."
            )
    else:
        values = [average] * horizon
        method, label = "average", "Average of your complete months"
        confidence = "low"
        explanation = (
            f"You have {len(history)} complete months, fewer than the "
            f"{MIN_MONTHS_FOR_TREND} needed to fit a trend, so this is simply your "
            f"average monthly saving repeated forward."
        )

    keys = _next_months(history[-1]["month"], horizon)
    result.update(
        method=method,
        method_label=label,
        slope_per_month=round(slope, 2),
        r2=round(r2, 3),
        # What the fit scored even when it was rejected, so the UI can explain
        # the rejection instead of silently showing an average.
        fitted_r2=round(fitted_r2, 3) if fitted_r2 is not None else None,
        average_savings=round(average, 2),
        recent_average=round(mean(savings[-3:]), 2),
        volatility=round(pstdev(savings), 2) if len(savings) > 1 else 0.0,
        confidence=confidence,
        explanation=explanation,
        predictions=[
            {"month": key, "label": month_label(key), "predicted_savings": round(value, 2)}
            for key, value in zip(keys, values)
        ],
        predicted_next=round(values[0], 2),
        predicted_total=round(sum(values), 2),
    )
    return result


def _add_months(start: date, count: int) -> date:
    total = start.month - 1 + count
    return date(start.year + total // 12, total % 12 + 1, 1)


def project_goal(goal: dict, monthly_savings: float, *, today: date | None = None) -> dict:
    """When a savings goal is reached at a given monthly rate.

    `monthly_savings` is the whole of the user's net saving. A goal funded out
    of it therefore shares that money with every other goal, which the note
    states explicitly rather than letting each goal imply it gets all of it.
    """
    today = today or date.today()
    remaining = max(0.0, float(goal.get("remaining") or 0))
    target_date = goal.get("target_date")
    out: dict = {
        "id": goal.get("id"),
        "name": goal.get("name"),
        "remaining": round(remaining, 2),
        "monthly_savings": round(monthly_savings, 2),
        "disclaimer": DISCLAIMER,
    }

    if remaining <= 0:
        out.update(reachable=True, months_needed=0, eta=None, eta_label="Already funded",
                   status="achieved", note="You have saved the full target amount.")
        return out

    if monthly_savings <= 0:
        out.update(
            reachable=False, months_needed=None, eta=None, eta_label="No estimate",
            status="stalled",
            note=("Your recorded net savings are not positive, so there is no rate "
                  "to project from. That is a missing estimate, not a prediction "
                  "that you will never reach the goal."),
        )
        return out

    months = remaining / monthly_savings
    whole = int(months) + (1 if months % 1 else 0)
    eta = _add_months(today, whole)
    plural = "s" if whole != 1 else ""
    out.update(
        reachable=True,
        months_needed=whole,
        eta=eta.isoformat(),
        eta_label=month_label(f"{eta.year:04d}-{eta.month:02d}"),
        status="on_track",
        note=(f"At {monthly_savings:,.0f} rupees saved a month it would take about "
              f"{whole} month{plural}. That assumes the whole of your net saving "
              f"goes to this goal."),
    )

    if target_date:
        deadline = date.fromisoformat(target_date)
        months_left = max(0, (deadline.year - today.year) * 12 + deadline.month - today.month)
        out["months_left"] = months_left
        out["required_monthly"] = round(remaining / months_left, 2) if months_left else None
        if eta > deadline:
            out["status"] = "behind"
            # Spelled out rather than ISO: this string is read as prose next
            # to formatted rupee amounts, and "2027-07-02" reads as data.
            readable = f"{deadline.day} {deadline:%B %Y}"
            out["note"] += f" Your target date of {readable} is earlier than that."
            out["note"] += (
                f" Reaching it on time needs about {remaining / months_left:,.0f} "
                f"rupees a month." if months_left else " That date has already passed."
            )
    return out
