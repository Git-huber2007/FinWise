"""Spending anomaly detection.

What this is NOT
----------------
This is not fraud detection, and nothing here ever labels a transaction as
fraud. It finds expenses that are unusually large *for this user, in this
category*, and asks them to confirm. An unusual purchase is overwhelmingly
likely to be a real purchase the user remembers making -- a laptop, a dental
bill, a wedding gift. Calling that fraud would be both wrong and alarming, so
every result carries ``needs_review`` and the UI presents it as a question.

How it decides
--------------
1. **Robust z-score (primary).** Median and MAD per category, with the
   Iglewicz-Hoaglin 3.5 threshold. Median and MAD are used rather than mean and
   standard deviation precisely because the outlier we are hunting for would
   otherwise inflate the very statistics meant to detect it: one 52,000 rupee
   purchase drags the mean of a shopping category up far enough to make itself
   look ordinary.
2. **IsolationForest (second opinion).** Fitted over the whole expense set.
   It only ever *raises confidence* in something rule 1 already flagged, and
   its own verdict is reported separately. It is not allowed to flag on its
   own: isolation is two-tailed, so it happily isolates the user's smallest
   transactions too, and "your 40 rupee bus fare is anomalous" is noise.

Only amounts ABOVE the usual are reported. An unusually cheap week is not a
problem the user needs an alert about.
"""
from __future__ import annotations

from collections import defaultdict
from statistics import median

from ai.analytics import month_key, month_label

# Iglewicz-Hoaglin: |modified z| > 3.5 marks a potential outlier. Kept at the
# published value rather than tuned by eye, so the threshold is defensible.
Z_THRESHOLD = 3.5
MAD_SCALE = 0.6745

# A category needs this many transactions before a median means anything.
# Under it we compare against the user's overall expense distribution instead,
# and say so in the reason.
MIN_CATEGORY_SAMPLES = 5

# Never raise an alert below this. Statistically unusual and worth a
# notification are different questions, and a 300 rupee surprise is not worth
# interrupting someone for.
MIN_ABSOLUTE_RUPEES = 1500.0

# ...and the amount must exceed what is typical BY this much. Both floors are
# needed, and the second was added after a real false positive: a tightly
# clustered Utilities category (broadband and mobile bills around 850 rupees)
# gave MAD a tiny value, so an ordinary 1,871 rupee summer electricity bill
# scored 5.8 modified z-scores and was reported as an anomaly. It was over the
# threshold and over the absolute floor, and still meant nothing -- 1,019
# rupees above usual is a warm month, not an event. Same reasoning as
# analytics.MIN_CHANGE_RUPEES: statistical significance is not significance.
MIN_EXCESS_RUPEES = 5000.0

# When every transaction in a category is identical (a fixed subscription, a
# fixed rent) MAD is zero and the z-score is undefined. Fall back to a plain
# multiple of the median.
FLAT_SERIES_MULTIPLE = 2.5

# IsolationForest needs a real sample before its notion of "isolated" is
# anything but noise.
MIN_ROWS_FOR_FOREST = 25

NOT_FRAUD = (
    "These are transactions that are unusually large compared with your own "
    "history. They are not fraud alerts -- most unusual purchases are simply "
    "unusual purchases. Please confirm each one."
)


def _expenses(rows) -> list[dict]:
    return [r for r in rows
            if r.get("txn_type") == "expense" and float(r.get("amount") or 0) > 0]


def _robust_z(amount: float, med: float, mad: float) -> float | None:
    if mad <= 0:
        return None
    return MAD_SCALE * (amount - med) / mad


def _category_stats(rows) -> dict[str, dict]:
    buckets: dict[str, list[float]] = defaultdict(list)
    for row in rows:
        buckets[row.get("category") or "Other"].append(float(row["amount"]))

    stats = {}
    for category, amounts in buckets.items():
        med = median(amounts)
        stats[category] = {
            "median": round(med, 2),
            "mad": round(median([abs(a - med) for a in amounts]), 2),
            "count": len(amounts),
            "max": round(max(amounts), 2),
        }
    return stats


def _forest_outliers(rows: list[dict], stats: dict[str, dict]) -> set:
    """Row ids IsolationForest considers isolated. Empty on a small sample.

    Features are the amount and its ratio to the category median: the ratio is
    what makes a 30,000 rupee rent payment ordinary and a 30,000 rupee food
    order not, which the raw amount alone cannot express.
    """
    if len(rows) < MIN_ROWS_FOR_FOREST:
        return set()
    try:
        from sklearn.ensemble import IsolationForest
    except ImportError:  # pragma: no cover - sklearn is a hard dependency
        return set()

    features, ids = [], []
    for row in rows:
        amount = float(row["amount"])
        med = stats.get(row.get("category") or "Other", {}).get("median") or amount
        features.append([amount, amount / med if med else 1.0])
        ids.append(row.get("id"))

    # random_state is fixed so the same data always produces the same alerts.
    # A detector whose findings change on refresh is not one a user can trust.
    model = IsolationForest(contamination="auto", random_state=20261104, n_estimators=100)
    verdicts = model.fit_predict(features)
    return {row_id for row_id, verdict in zip(ids, verdicts) if verdict == -1}


def detect(rows, *, month: str | None = None) -> dict:
    """Find unusually large expenses.

    `month` narrows the *reported* anomalies to one month, but the statistics
    are always built from the user's whole history -- a single month is not
    enough data to know what is normal for them.
    """
    expenses = _expenses(rows)
    stats = _category_stats(expenses)
    overall = {"median": round(median([float(r["amount"]) for r in expenses]), 2),
               "count": len(expenses)} if expenses else {"median": 0.0, "count": 0}
    if expenses:
        overall["mad"] = round(
            median([abs(float(r["amount"]) - overall["median"]) for r in expenses]), 2
        )
    else:
        overall["mad"] = 0.0

    forest = _forest_outliers(expenses, stats)
    found: list[dict] = []

    for row in expenses:
        amount = float(row["amount"])
        if amount < MIN_ABSOLUTE_RUPEES:
            continue

        category = row.get("category") or "Other"
        stat = stats.get(category, {})
        enough = stat.get("count", 0) >= MIN_CATEGORY_SAMPLES
        basis = category if enough else "all your spending"
        reference = stat if enough else overall

        med = float(reference.get("median") or 0)
        mad = float(reference.get("mad") or 0)
        if med <= 0:
            continue

        score = _robust_z(amount, med, mad)
        times = amount / med

        if score is not None:
            flagged = score >= Z_THRESHOLD
            method = "robust z-score (median + MAD)"
            measure = f"{score:.1f} modified z-scores above the median"
        else:
            # MAD of zero: every comparable transaction is the same amount.
            flagged = times >= FLAT_SERIES_MULTIPLE
            method = "multiple of a flat series"
            measure = f"{times:.1f} times the usual amount"

        # The excess floor is checked alongside the statistical test, not
        # instead of it: both have to agree before the user is interrupted.
        if not flagged or (amount - med) < MIN_EXCESS_RUPEES:
            continue

        in_forest = row.get("id") in forest
        # Severity is deliberately coarse, and deliberately NOT influenced by
        # the forest: anything the z-score flags is usually isolated too, so
        # including it just set every alert to "high" and the band stopped
        # carrying information. Magnitude is what the user can act on.
        severity = "high" if times >= 5 else "medium"

        found.append({
            "id": row.get("id"),
            "date": row.get("date"),
            "description": row.get("description"),
            "category": category,
            "amount": round(amount, 2),
            "payment_method": row.get("payment_method"),
            "month": month_key(row.get("date")),
            "typical": round(med, 2),
            "times_typical": round(times, 1),
            "robust_z": round(score, 2) if score is not None else None,
            "method": method,
            "forest_agrees": in_forest,
            "severity": severity,
            "needs_review": True,
            "reason": (
                f"At {amount:,.0f} rupees this is {times:.1f} times your typical "
                f"{basis} transaction of {med:,.0f} rupees -- {measure}."
                + (" An unsupervised IsolationForest over all your expenses also "
                   "isolates it." if in_forest else "")
            ),
        })

    found.sort(key=lambda a: (a["date"] or "", a["amount"]), reverse=True)
    reported = [a for a in found if month is None or a["month"] == month]

    return {
        "anomalies": reported,
        "count": len(reported),
        "total_amount": round(sum(float(a["amount"]) for a in reported), 2),
        "all_time_count": len(found),
        "month": month,
        "month_label": month_label(month) if month else None,
        "examined": len(expenses),
        "forest_used": bool(forest),
        "category_stats": stats,
        "thresholds": {
            "modified_z": Z_THRESHOLD,
            "minimum_rupees": MIN_ABSOLUTE_RUPEES,
            "minimum_excess_rupees": MIN_EXCESS_RUPEES,
            "minimum_category_samples": MIN_CATEGORY_SAMPLES,
        },
        "note": NOT_FRAUD,
    }


def latest_alerts(rows, limit: int = 3) -> list[dict]:
    """The most recent anomalies, for the dashboard banner."""
    return detect(rows)["anomalies"][:limit]
