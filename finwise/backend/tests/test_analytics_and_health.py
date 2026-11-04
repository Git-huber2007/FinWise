"""Analytics and health-score tests.

Fixtures are small enough that every expected figure below is computed by hand
in the assertion's comment. A test that asserts whatever the code happens to
produce verifies nothing.
"""
import pytest

from ai import analytics, health


def txn(date, amount, category, txn_type="expense", id=None):
    return {"id": id or abs(hash((date, amount, category))) % 100000,
            "date": date, "amount": float(amount),
            "category": category, "txn_type": txn_type}


@pytest.fixture
def rows():
    """Two months, hand-checkable.

    September: income 40000; expenses 5000 + 3000 + 2000 = 10000
               savings 30000, rate 75.0%
    October:   income 40000; expenses 8000 + 4000 + 1000 = 13000
               savings 27000, rate 67.5%
    """
    return [
        txn("2026-09-01", 40000, "Salary", "income"),
        txn("2026-09-05", 5000, "Food"),
        txn("2026-09-12", 3000, "Shopping"),
        txn("2026-09-20", 2000, "Transportation"),
        txn("2026-10-01", 40000, "Salary", "income"),
        txn("2026-10-06", 8000, "Food"),
        txn("2026-10-14", 4000, "Shopping"),
        txn("2026-10-22", 1000, "Transportation"),
    ]


# --------------------------------------------------------------------------
# Aggregation
# --------------------------------------------------------------------------

def test_monthly_series_arithmetic(rows):
    series = analytics.monthly_series(rows)
    assert [m["month"] for m in series] == ["2026-09", "2026-10"]

    september, october = series
    assert september["income"] == 40000.0
    assert september["expense"] == 10000.0          # 5000+3000+2000
    assert september["savings"] == 30000.0          # 40000-10000
    assert september["savings_rate"] == 75.0        # 30000/40000

    assert october["expense"] == 13000.0            # 8000+4000+1000
    assert october["savings"] == 27000.0
    assert october["savings_rate"] == 67.5          # 27000/40000


def test_series_is_oldest_first_and_labelled(rows):
    series = analytics.monthly_series(rows)
    assert series[0]["label"] == "Sep 2026"
    assert series[-1]["label"] == "Oct 2026"


def test_savings_rate_is_none_without_income():
    series = analytics.monthly_series([txn("2026-10-01", 500, "Food")])
    assert series[0]["savings_rate"] is None, "a rate on zero income is undefined, not 0"


def test_category_breakdown_shares_sum_to_100(rows):
    october = analytics.filter_month(rows, "2026-10")
    breakdown = analytics.category_breakdown(october)

    assert breakdown[0]["category"] == "Food"       # largest first
    assert breakdown[0]["amount"] == 8000.0
    assert breakdown[0]["share"] == 61.5            # 8000/13000
    assert sum(b["share"] for b in breakdown) == pytest.approx(100.0, abs=0.2)


def test_breakdown_excludes_income(rows):
    breakdown = analytics.category_breakdown(analytics.filter_month(rows, "2026-10"))
    assert "Salary" not in [b["category"] for b in breakdown]


def test_breakdown_average_per_transaction():
    rows = [txn("2026-10-01", 300, "Food"), txn("2026-10-02", 500, "Food")]
    item = analytics.category_breakdown(rows)[0]
    assert item["transactions"] == 2
    assert item["average"] == 400.0                 # (300+500)/2


def test_month_over_month_changes(rows):
    comparison = analytics.month_over_month(rows, "2026-10", "2026-09")
    by_category = {c["category"]: c for c in comparison}

    assert by_category["Food"]["change"] == 3000.0          # 8000-5000
    assert by_category["Food"]["change_pct"] == 60.0        # 3000/5000
    assert by_category["Transportation"]["change"] == -1000.0
    assert by_category["Transportation"]["change_pct"] == -50.0
    # Biggest absolute mover first
    assert comparison[0]["category"] == "Food"


def test_percent_change_is_none_without_a_baseline():
    rows = [txn("2026-10-01", 900, "Healthcare")]
    comparison = analytics.month_over_month(rows, "2026-10", "2026-09")
    healthcare = next(c for c in comparison if c["category"] == "Healthcare")
    assert healthcare["change"] == 900.0
    assert healthcare["change_pct"] is None, "a % rise from zero is not meaningful"


def test_rupee_formatting_uses_indian_grouping():
    assert analytics._rupees(1234567) == "₹12,34,567"
    assert analytics._rupees(45000) == "₹45,000"
    assert analytics._rupees(500) == "₹500"


# --------------------------------------------------------------------------
# Budgets
# --------------------------------------------------------------------------

def budget(category, amount, month=10, year=2026, id=1):
    return {"id": id, "category": category, "amount": amount, "month": month, "year": year}


def test_budget_alert_statuses(rows):
    alerts = analytics.budget_alerts(rows, [
        budget("Food", 6000, id=1),        # spent 8000 -> over
        budget("Shopping", 5000, id=2),    # spent 4000 -> 80% -> warning
        budget("Transportation", 5000, id=3),  # spent 1000 -> 20% -> ok
    ], "2026-10")

    by_category = {a["category"]: a for a in alerts}
    assert by_category["Food"]["status"] == "over"
    assert by_category["Food"]["remaining"] == -2000.0
    assert by_category["Shopping"]["used_pct"] == 80.0
    assert by_category["Shopping"]["status"] == "warning"
    assert by_category["Transportation"]["status"] == "ok"
    assert alerts[0]["category"] == "Food", "most-used budget first"


def test_overall_budget_covers_every_category(rows):
    alerts = analytics.budget_alerts(rows, [budget(None, 20000)], "2026-10")
    assert alerts[0]["label"] == "Overall monthly"
    assert alerts[0]["spent"] == 13000.0            # all October expenses
    assert alerts[0]["remaining"] == 7000.0


def test_budgets_for_another_month_are_ignored(rows):
    alerts = analytics.budget_alerts(rows, [budget("Food", 6000, month=9)], "2026-10")
    assert alerts == []


# --------------------------------------------------------------------------
# Insights -- must be grounded, and must not be noise
# --------------------------------------------------------------------------

def test_insights_report_a_real_category_rise(rows):
    insights = analytics.generate_insights(rows, current="2026-10")
    titles = " | ".join(i["title"] for i in insights)
    assert "Food spending rose 60.0%" in titles
    body = next(i["body"] for i in insights if "Food spending rose" in i["title"])
    assert "₹8,000" in body and "₹5,000" in body, "an insight must show its figures"


def test_small_moves_are_not_reported():
    """Without a rupee floor, a ₹60 change becomes 'healthcare rose 300%'."""
    rows = [
        txn("2026-09-01", 30000, "Salary", "income"),
        txn("2026-09-05", 20, "Healthcare"),
        txn("2026-10-01", 30000, "Salary", "income"),
        txn("2026-10-05", 80, "Healthcare"),   # +300% but only ₹60
    ]
    insights = analytics.generate_insights(rows, current="2026-10")
    assert not any("Healthcare" in i["title"] for i in insights)


def test_overspending_is_critical(rows):
    rows = rows + [txn("2026-10-28", 40000, "Shopping")]
    insights = analytics.generate_insights(rows, current="2026-10")
    assert insights[0]["severity"] == "critical"
    assert "more than you earned" in insights[0]["title"]


def test_no_transactions_produces_no_insights():
    assert analytics.generate_insights([]) == []


def test_reduction_opportunity_is_plain_arithmetic(rows):
    insights = analytics.generate_insights(rows, current="2026-10")
    cut = next((i for i in insights if "Cutting" in i["title"]), None)
    assert cut is not None
    # Food is 8000; 20% of that is 1600
    assert "₹1,600" in cut["title"]
    assert "not a prediction" in cut["body"]


# --------------------------------------------------------------------------
# Health score
# --------------------------------------------------------------------------

def test_weights_sum_to_100():
    assert sum(health.WEIGHTS.values()) == 100


def test_score_is_bounded_and_components_sum_to_it(rows):
    result = health.financial_health(rows)
    assert 0 <= result["score"] <= 100
    assert result["score"] == round(sum(c["points"] for c in result["components"]))
    assert sum(c["max_points"] for c in result["components"]) == 100


def test_every_component_explains_itself(rows):
    for component in health.financial_health(rows)["components"]:
        assert component["explanation"], f"{component['key']} has no explanation"
        assert "label" in component and "points" in component


def test_healthy_finances_score_higher_than_unhealthy():
    good = [txn(f"2026-0{m}-01", 50000, "Salary", "income") for m in range(1, 7)]
    good += [txn(f"2026-0{m}-05", 25000, "Housing") for m in range(1, 7)]

    bad = [txn(f"2026-0{m}-01", 50000, "Salary", "income") for m in range(1, 7)]
    bad += [txn(f"2026-0{m}-05", 49000, "Shopping") for m in range(1, 7)]

    assert health.financial_health(good)["score"] > health.financial_health(bad)["score"]


def test_savings_rate_component_is_computed_as_documented(rows):
    """September 75% + October 67.5% -> mean 71.25%, capped at the 30% anchor."""
    component = next(c for c in health.financial_health(rows)["components"]
                     if c["key"] == "savings_rate")
    assert component["value"] == pytest.approx(71.3, abs=0.1)
    assert component["points"] == 30.0, "above the 30% target scores full marks"


def test_no_budgets_scores_neutral_not_zero(rows):
    """Not having used a feature is not the same as failing at it."""
    component = next(c for c in health.financial_health(rows, budgets=[])["components"]
                     if c["key"] == "budget_discipline")
    assert component["neutral"] is True
    assert component["points"] == 10.0              # half of the 20-point weight


def test_emergency_fund_scores_zero_when_unreported(rows):
    component = next(c for c in health.financial_health(rows)["components"]
                     if c["key"] == "emergency_fund")
    assert component["points"] == 0.0
    assert component["self_reported"] is True


def test_emergency_fund_months_of_cover(rows):
    """Average monthly expense is (10000+13000)/2 = 11500. 69000/11500 = 6 months."""
    component = next(c for c in health.financial_health(rows, emergency_fund=69000)["components"]
                     if c["key"] == "emergency_fund")
    assert component["value"] == pytest.approx(6.0, abs=0.05)
    assert component["points"] == 15.0              # full marks at 6 months


def test_short_history_is_flagged_provisional():
    rows = [txn("2026-10-01", 30000, "Salary", "income"), txn("2026-10-05", 5000, "Food")]
    result = health.financial_health(rows)
    assert result["provisional"] is True
    assert any("provisional" in w for w in result["warnings"])


def test_no_data_returns_a_usable_shape():
    result = health.financial_health([])
    assert result["score"] == 0
    assert result["band"] == "No data"
    assert result["components"] == []
    assert result["recommendations"]


def test_disclaimer_denies_being_a_credit_score(rows):
    disclaimer = health.financial_health(rows)["disclaimer"]
    assert "not a credit score" in disclaimer
    assert "not financial advice" in disclaimer


def test_savings_target_is_20_percent_of_actual_income(rows):
    target = health.financial_health(rows)["suggested_savings_target"]
    assert target["monthly_target"] == 8000.0       # 20% of October's 40000
    assert target["achieved"] is True               # saved 27000


def test_overspending_produces_a_warning(rows):
    rows = rows + [txn("2026-10-28", 40000, "Shopping")]
    result = health.financial_health(rows)
    assert any("more than you earned" in w for w in result["warnings"])


def test_bands_are_ordered():
    assert health._band(90) == "Excellent"
    assert health._band(70) == "Good"
    assert health._band(55) == "Fair"
    assert health._band(40) == "Needs attention"
    assert health._band(10) == "At risk"


# --------------------------------------------------------------------------
# Partial (in-progress) month handling
#
# Regression tests for a real bug: comparing 4 elapsed days against a whole
# previous month reported "Housing spending fell 100%" because the rent had
# simply not been paid yet. An absence is not a decrease.
# --------------------------------------------------------------------------

from datetime import date, timedelta  # noqa: E402


def _partial_month_rows():
    """Last month complete; this month only up to today."""
    today = date.today()
    this_start = date(today.year, today.month, 1)
    last_start = (this_start - timedelta(days=1)).replace(day=1)

    rows = [
        # last month: salary on the 1st, rent on the 20th
        txn(f"{last_start:%Y-%m}-01", 50000, "Salary", "income"),
        txn(f"{last_start:%Y-%m}-20", 18000, "Housing"),
        txn(f"{last_start:%Y-%m}-02", 900, "Food"),
        # this month: salary landed, rent has NOT yet
        txn(f"{this_start:%Y-%m}-01", 50000, "Salary", "income"),
        txn(f"{this_start:%Y-%m}-01", 800, "Food"),
    ]
    return rows, f"{this_start:%Y-%m}", f"{last_start:%Y-%m}"


@pytest.mark.skipif(
    date.today().day >= 20,
    reason="past the 20th, so last month's rent IS inside the elapsed window and the comparison is genuine",
)
def test_unpaid_rent_is_not_reported_as_a_decrease():
    rows, current, _ = _partial_month_rows()
    titles = " | ".join(i["title"] for i in analytics.generate_insights(rows, current=current))
    assert "Housing spending fell" not in titles, (
        "rent not yet due is an absence, not a 100% reduction"
    )


def test_partial_month_comparison_is_like_for_like():
    rows, current, previous = _partial_month_rows()
    day = analytics.elapsed_day(current)
    assert day is not None, "the current month must be detected as in progress"

    comparison = analytics.month_over_month(rows, current, previous, upto_day=day)
    housing = next((c for c in comparison if c["category"] == "Housing"), None)
    if date.today().day < 20:
        # Rent falls outside the elapsed window in BOTH months, so it is
        # absent from the comparison rather than appearing as a fall.
        assert housing is None or housing["previous"] == 0.0


def test_savings_rate_insight_suppressed_mid_month():
    """Income lands on day 1, bills land later -- an early rate means nothing."""
    rows, current, _ = _partial_month_rows()
    titles = " | ".join(i["title"] for i in analytics.generate_insights(rows, current=current))
    assert "savings rate" not in titles.lower()


def test_complete_month_still_reports_savings_rate(rows):
    """The suppression must not silence genuinely complete months."""
    titles = " | ".join(i["title"] for i in analytics.generate_insights(rows, current="2026-10"))
    assert "savings rate" in titles.lower()


def test_health_averages_exclude_the_in_progress_month():
    """A 96% month-to-date rate must not inflate the averaged savings score."""
    rows, _, _ = _partial_month_rows()
    # Add enough complete months for the exclusion to engage.
    today = date.today()
    for back in range(2, 5):
        month = (date(today.year, today.month, 1) - timedelta(days=28 * back)).replace(day=1)
        rows += [
            txn(f"{month:%Y-%m}-01", 50000, "Salary", "income"),
            txn(f"{month:%Y-%m}-10", 45000, "Housing"),   # only 10% saved
        ]

    component = next(c for c in health.financial_health(rows)["components"]
                     if c["key"] == "savings_rate")
    assert component["value"] is not None
    assert component["value"] < 50, (
        f"partial month inflated the average savings rate to {component['value']}%"
    )


def test_filter_month_upto_day_truncates():
    rows = [txn("2026-10-03", 100, "Food"), txn("2026-10-25", 900, "Food")]
    assert len(analytics.filter_month(rows, "2026-10")) == 2
    assert len(analytics.filter_month(rows, "2026-10", upto_day=10)) == 1


def test_month_over_month_auto_truncates_an_in_progress_month():
    """Regression: the routes called this WITHOUT a window and reported
    '-100%' for categories whose bill simply was not due yet. The default
    must be the correct comparison, not the naive one."""
    rows, current, previous = _partial_month_rows()
    if date.today().day >= 20:
        return  # rent is inside the window; nothing to prove

    # No upto_day passed - exactly how routes/ai.py and routes/dashboard.py call it.
    comparison = analytics.month_over_month(rows, current, previous)
    housing = next((c for c in comparison if c["category"] == "Housing"), None)
    assert housing is None or housing["change_pct"] != -100.0, (
        "an unpaid-yet bill must not be reported as a 100% reduction"
    )
