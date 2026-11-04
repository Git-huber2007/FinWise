"""Spending analytics.

Pure functions over plain dicts. They take the output of ``Transaction
.to_dict()`` and return plain data, so every rule below is unit-testable
without a database, an app context or an HTTP request.

Everything here is arithmetic on the user's own rows. Nothing is generated,
estimated or inferred by a language model: an insight that cannot point at a
number the user could recompute by hand does not belong in this file.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from typing import Iterable

Row = dict


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

def _as_date(value) -> date | None:
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return datetime.strptime(value[:10], "%Y-%m-%d").date()
        except ValueError:
            return None
    return None


def month_key(value) -> str | None:
    """'2026-10' — the grouping key used throughout this module."""
    parsed = _as_date(value)
    return f"{parsed.year:04d}-{parsed.month:02d}" if parsed else None


def month_label(key: str) -> str:
    """'2026-10' -> 'Oct 2026', for chart axes."""
    year, month = key.split("-")
    return f"{date(int(year), int(month), 1):%b %Y}"


def _pct_change(current: float, previous: float) -> float | None:
    """Percentage change, or None when there is no meaningful baseline.

    Returning None rather than 0 or infinity matters: "spending rose 100%
    versus a month where you spent nothing" is not a useful statement, and the
    UI needs to be able to say "no comparison available" instead.
    """
    if previous <= 0:
        return None
    return round((current - previous) / previous * 100, 1)


# --------------------------------------------------------------------------
# Aggregation
# --------------------------------------------------------------------------

def monthly_series(rows: Iterable[Row]) -> list[dict]:
    """Income, expense and savings per calendar month, oldest first."""
    buckets: dict[str, dict] = defaultdict(lambda: {"income": 0.0, "expense": 0.0, "count": 0})

    for row in rows:
        key = month_key(row.get("date"))
        if key is None:
            continue
        bucket = buckets[key]
        amount = float(row.get("amount") or 0)
        if row.get("txn_type") == "income":
            bucket["income"] += amount
        else:
            bucket["expense"] += amount
        bucket["count"] += 1

    series = []
    for key in sorted(buckets):
        bucket = buckets[key]
        income = round(bucket["income"], 2)
        expense = round(bucket["expense"], 2)
        series.append({
            "month": key,
            "label": month_label(key),
            "income": income,
            "expense": expense,
            "savings": round(income - expense, 2),
            # Share of income kept. Undefined without income, hence None.
            "savings_rate": round((income - expense) / income * 100, 1) if income > 0 else None,
            "transactions": bucket["count"],
        })
    return series


def category_breakdown(rows: Iterable[Row]) -> list[dict]:
    """Expense totals per category, largest first, with each one's share."""
    totals: dict[str, float] = defaultdict(float)
    counts: dict[str, int] = defaultdict(int)

    for row in rows:
        if row.get("txn_type") != "expense":
            continue
        category = row.get("category") or "Other"
        totals[category] += float(row.get("amount") or 0)
        counts[category] += 1

    grand_total = sum(totals.values())
    breakdown = [
        {
            "category": category,
            "amount": round(amount, 2),
            "share": round(amount / grand_total * 100, 1) if grand_total else 0.0,
            "transactions": counts[category],
            "average": round(amount / counts[category], 2) if counts[category] else 0.0,
        }
        for category, amount in totals.items()
    ]
    breakdown.sort(key=lambda item: item["amount"], reverse=True)
    return breakdown


def filter_month(rows: Iterable[Row], key: str, upto_day: int | None = None) -> list[Row]:
    """Rows in a month, optionally only up to a given day of that month.

    `upto_day` exists for comparing an in-progress month against the same
    elapsed portion of an earlier one. Comparing four days against a whole
    month produces statements like "housing spending fell 100%" when the rent
    simply has not been paid yet -- a false conclusion, not an insight.
    """
    out = []
    for row in rows:
        parsed = _as_date(row.get("date"))
        if parsed is None or month_key(parsed) != key:
            continue
        if upto_day is not None and parsed.day > upto_day:
            continue
        out.append(row)
    return out


def is_current_month(key: str) -> bool:
    today = date.today()
    return key == f"{today.year:04d}-{today.month:02d}"


def elapsed_day(key: str) -> int | None:
    """How far through `key` we are, or None if the month is complete."""
    return date.today().day if is_current_month(key) else None


def totals_for(rows: Iterable[Row]) -> dict:
    income = sum(float(r["amount"]) for r in rows if r.get("txn_type") == "income")
    expense = sum(float(r["amount"]) for r in rows if r.get("txn_type") == "expense")
    return {
        "income": round(income, 2),
        "expense": round(expense, 2),
        "savings": round(income - expense, 2),
        "savings_rate": round((income - expense) / income * 100, 1) if income > 0 else None,
        "transactions": len(list(rows)),
    }


def month_over_month(
    rows: Iterable[Row], current: str, previous: str, *, upto_day: int | None = None
) -> list[dict]:
    """Per-category change between two months, biggest absolute move first.

    BOTH months are truncated to the same elapsed day so the comparison is
    like-for-like. When `upto_day` is omitted this is worked out from
    `current`: an in-progress month truncates to today, a complete one does
    not truncate at all.

    The default is the safe behaviour on purpose. Callers that forgot to pass
    a window produced "housing spending fell 100%" the moment the rent was not
    yet due -- so the correct comparison is what you get for free, and the
    parameter exists only to override it.
    """
    if upto_day is None:
        upto_day = elapsed_day(current)
    rows = list(rows)
    now = {item["category"]: item
           for item in category_breakdown(filter_month(rows, current, upto_day))}
    before = {item["category"]: item
              for item in category_breakdown(filter_month(rows, previous, upto_day))}

    # Carry the sort key alongside each row rather than reading it back out of
    # the dict: these rows hold mixed types (including None for change_pct),
    # so the key is only unambiguous here, where it is still a float.
    ranked: list[tuple[float, dict]] = []
    for category in sorted(set(now) | set(before)):
        current_amount = float(now.get(category, {}).get("amount", 0.0))
        previous_amount = float(before.get(category, {}).get("amount", 0.0))
        change = round(current_amount - previous_amount, 2)
        ranked.append((abs(change), {
            "category": category,
            "current": current_amount,
            "previous": previous_amount,
            "change": change,
            "change_pct": _pct_change(current_amount, previous_amount),
        }))

    ranked.sort(key=lambda pair: pair[0], reverse=True)
    return [row for _, row in ranked]


# --------------------------------------------------------------------------
# Insights
# --------------------------------------------------------------------------

# A category has to move by more than this, in both rupees and percent, before
# it is worth telling the user about. Without both floors the feed fills with
# "your healthcare spending rose 300%" about a 60-rupee difference.
MIN_CHANGE_RUPEES = 500.0
MIN_CHANGE_PCT = 15.0


def generate_insights(
    rows: Iterable[Row],
    *,
    current: str | None = None,
    budgets: list[dict] | None = None,
    limit: int = 8,
) -> list[dict]:
    """Observations derived strictly from the user's own transactions.

    Every insight carries the figures it was computed from, so the UI can show
    the user why it was said. Ordered by severity, then by rupee impact.
    """
    rows = list(rows)
    series = monthly_series(rows)
    if not series:
        return []

    current = current or series[-1]["month"]
    this_month = next((m for m in series if m["month"] == current), None)
    if this_month is None:
        return []

    index = series.index(this_month)
    last_month = series[index - 1] if index > 0 else None

    # An in-progress month is only partly spent. Every comparison below has to
    # account for that or it reports absences as decreases.
    day = elapsed_day(current)
    partial = day is not None
    window = f" in the first {day} day(s)" if partial else ""

    insights: list[dict] = []

    def add(kind, title, body, severity="info", impact=0.0):
        insights.append({"kind": kind, "title": title, "body": body,
                         "severity": severity, "impact": round(abs(impact), 2)})

    # --- savings rate ----------------------------------------------------
    # Skipped for an in-progress month: income usually lands on day 1 while
    # rent and bills land later, so an early-month rate reads as spectacular
    # and means nothing.
    rate = None if partial else this_month["savings_rate"]
    if rate is not None:
        if rate < 0:
            add("saving", "You spent more than you earned this month",
                f"Expenses of {_rupees(this_month['expense'])} exceeded income of "
                f"{_rupees(this_month['income'])}, a shortfall of "
                f"{_rupees(abs(this_month['savings']))}.",
                severity="critical", impact=abs(this_month["savings"]))
        elif rate < 10:
            add("saving", f"Your savings rate is {rate}%",
                f"You kept {_rupees(this_month['savings'])} of "
                f"{_rupees(this_month['income'])}. A rate under 10% leaves little "
                f"room for an unexpected expense.",
                severity="warning", impact=this_month["savings"])
        elif rate >= 30:
            add("saving", f"Strong savings rate of {rate}%",
                f"You kept {_rupees(this_month['savings'])} of "
                f"{_rupees(this_month['income'])} this month.",
                severity="info", impact=this_month["savings"])

    # --- category concentration -----------------------------------------
    breakdown = category_breakdown(filter_month(rows, current, day))
    if breakdown:
        top = breakdown[0]
        # The rupee floor matters as much as the share: one ₹80 purchase in a
        # month is "100% of your spending" and telling the user that is noise.
        if top["share"] >= 30 and top["amount"] >= MIN_CHANGE_RUPEES:
            add("trend", f"{top['category']} is {top['share']}% of your spending{window}",
                f"You spent {_rupees(top['amount'])} on {top['category']} across "
                f"{top['transactions']} transactions this month.",
                severity="warning" if top["share"] >= 45 else "info",
                impact=top["amount"])

    # --- month-over-month movement ---------------------------------------
    # Both months are truncated to the same elapsed day, so this compares
    # like with like rather than a part-month against a whole one.
    if last_month:
        comparison = month_over_month(rows, current, last_month["month"], upto_day=day)
        for item in comparison:
            change, pct = item["change"], item["change_pct"]
            if pct is None or abs(change) < MIN_CHANGE_RUPEES or abs(pct) < MIN_CHANGE_PCT:
                continue
            versus = (f"{_rupees(item['current'])} versus {_rupees(item['previous'])} "
                      f"over the same days last month" if partial else
                      f"{_rupees(item['current'])} this month versus "
                      f"{_rupees(item['previous'])} last month")
            if change > 0:
                add("trend", f"{item['category']} spending rose {pct}%{window}",
                    f"{versus}, up {_rupees(change)}.",
                    severity="warning", impact=change)
            else:
                add("trend", f"{item['category']} spending fell {abs(pct)}%{window}",
                    f"{versus}, down {_rupees(abs(change))}.",
                    severity="info", impact=change)

        current_spend = sum(float(r["amount"]) for r in filter_month(rows, current, day)
                            if r.get("txn_type") == "expense")
        previous_spend = sum(float(r["amount"])
                             for r in filter_month(rows, last_month["month"], day)
                             if r.get("txn_type") == "expense")
        total_change = current_spend - previous_spend
        total_pct = _pct_change(current_spend, previous_spend)
        if total_pct is not None and abs(total_change) >= MIN_CHANGE_RUPEES:
            direction = "higher" if total_change > 0 else "lower"
            against = "over the same days last month" if partial else "than last month"
            add("trend", f"Total spending is {abs(total_pct)}% {direction} {against}",
                f"{_rupees(current_spend)} versus {_rupees(previous_spend)}.",
                severity="warning" if total_change > 0 else "info", impact=total_change)

    # --- budget overruns --------------------------------------------------
    for alert in budget_alerts(rows, budgets or [], current):
        if alert["status"] == "over":
            add("budget", f"{alert['label']} budget exceeded",
                f"Spent {_rupees(alert['spent'])} against a budget of "
                f"{_rupees(alert['budget'])} — over by "
                f"{_rupees(abs(alert['remaining']))}.",
                severity="critical", impact=abs(alert["remaining"]))
        elif alert["status"] == "warning":
            add("budget", f"{alert['label']} budget is {alert['used_pct']}% used",
                f"{_rupees(alert['spent'])} of {_rupees(alert['budget'])}, leaving "
                f"{_rupees(alert['remaining'])}.",
                severity="warning", impact=alert["remaining"])

    # --- a concrete, arithmetic reduction opportunity --------------------
    discretionary = [b for b in breakdown
                     if b["category"] in {"Entertainment", "Shopping", "Food"}
                     and b["amount"] >= MIN_CHANGE_RUPEES]
    if discretionary:
        target = max(discretionary, key=lambda b: b["amount"])
        saving = round(float(target["amount"]) * 0.20, 2)
        # The SAVING has to be worth acting on, not merely the category total:
        # "cut your food bill by 20% to free ₹115" is noise four days into a
        # month, and noise is what makes a user stop reading insights.
        if saving >= MIN_CHANGE_RUPEES:
            add("saving", f"Cutting {target['category']} by 20% would free {_rupees(saving)}",
                f"You spent {_rupees(target['amount'])} on {target['category']}{window} "
                f"across {target['transactions']} transactions, averaging "
                f"{_rupees(target['average'])} each. This is arithmetic on your own "
                f"spending, not a prediction.",
                severity="info", impact=saving)

    severity_rank = {"critical": 0, "warning": 1, "info": 2}
    insights.sort(key=lambda i: (severity_rank[i["severity"]], -i["impact"]))
    return insights[:limit]


def _rupees(value: float) -> str:
    """Indian digit grouping: 12,34,567 rather than 1,234,567."""
    whole = int(round(abs(float(value))))
    text = str(whole)
    if len(text) > 3:
        head, tail = text[:-3], text[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        text = ",".join(parts + [tail])
    return f"₹{text}"


# --------------------------------------------------------------------------
# Budgets
# --------------------------------------------------------------------------

WARN_AT_PCT = 80.0


def budget_alerts(rows: Iterable[Row], budgets: list[dict], current: str) -> list[dict]:
    """Compare each budget against actual spending for the given month."""
    rows = list(rows)
    month_rows = filter_month(rows, current)
    spent_by_category = {b["category"]: b["amount"] for b in category_breakdown(month_rows)}
    overall_spent = round(sum(spent_by_category.values()), 2)

    year, month = (int(part) for part in current.split("-"))
    ranked: list[tuple[float, dict]] = []

    for budget in budgets:
        if budget.get("month") != month or budget.get("year") != year:
            continue
        category = budget.get("category")
        limit = float(budget.get("amount") or 0)
        if limit <= 0:
            continue

        spent = overall_spent if category is None else spent_by_category.get(category, 0.0)
        used_pct = round(spent / limit * 100, 1)
        ranked.append((used_pct, {
            "budget_id": budget.get("id"),
            "category": category,
            "label": category or "Overall monthly",
            "budget": round(limit, 2),
            "spent": round(spent, 2),
            "remaining": round(limit - spent, 2),
            "used_pct": used_pct,
            "status": "over" if used_pct > 100 else "warning" if used_pct >= WARN_AT_PCT else "ok",
        }))

    ranked.sort(key=lambda pair: pair[0], reverse=True)
    return [alert for _, alert in ranked]
