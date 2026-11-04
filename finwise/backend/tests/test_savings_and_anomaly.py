"""Savings forecast and anomaly detection tests.

Two themes run through this file:

* **Hand-computable fixtures.** A forecast over a series whose answer can be
  worked out on paper is the only way to know the arithmetic is right rather
  than merely stable.
* **The refusals are tested as hard as the answers.** Both modules are allowed
  to decline: the forecast refuses to project a trend it cannot support, and
  the detector refuses to report an unusual-but-trivial amount. Those refusals
  are the features that stop the app inventing insights, so each has a test
  that fails if the refusal is removed.
"""
import pytest

from ai import anomaly, savings


def txn(date, amount, category, txn_type="expense", row_id=None):
    return {"id": row_id if row_id is not None else abs(hash((date, amount, category))) % 100000,
            "date": date, "amount": float(amount), "description": f"{category} spend",
            "category": category, "txn_type": txn_type, "payment_method": "UPI"}


def month_of(key, income, expense):
    """One income row and one expense row in a given month."""
    return [txn(f"{key}-01", income, "Salary", "income"),
            txn(f"{key}-15", expense, "Food")]


# --------------------------------------------------------------------------
# The fit itself
# --------------------------------------------------------------------------

def test_fit_line_recovers_a_known_slope_exactly():
    """y = 100 + 50x has slope 50, intercept 100 and explains everything."""
    slope, intercept, r2 = savings._fit_line([100, 150, 200, 250, 300])
    assert slope == pytest.approx(50.0)
    assert intercept == pytest.approx(100.0)
    assert r2 == pytest.approx(1.0)


def test_fit_line_reports_no_explanatory_power_for_a_flat_series():
    slope, intercept, r2 = savings._fit_line([200, 200, 200, 200])
    assert slope == pytest.approx(0.0)
    assert intercept == pytest.approx(200.0)
    # Not 1.0. There is no variation to explain, and claiming a perfect fit
    # would let a flat series pose as a high-confidence forecast.
    assert r2 == 0.0


# --------------------------------------------------------------------------
# predict()
# --------------------------------------------------------------------------

def test_a_clean_upward_trend_is_fitted_and_projected():
    """Savings of 5k, 6k, 7k, 8k, 9k -> next month 10k."""
    rows = []
    for index, key in enumerate(["2026-01", "2026-02", "2026-03", "2026-04", "2026-05"]):
        rows += month_of(key, 40000, 35000 - index * 1000)

    result = savings.predict(rows, horizon=2)
    assert result["method"] == "linear_trend"
    assert result["r2"] == pytest.approx(1.0)
    assert result["slope_per_month"] == pytest.approx(1000.0)
    assert result["predictions"][0]["month"] == "2026-06"
    assert result["predictions"][0]["predicted_savings"] == pytest.approx(10000.0)
    assert result["predictions"][1]["predicted_savings"] == pytest.approx(11000.0)


def test_a_noisy_series_refuses_to_claim_a_trend():
    """The regression-through-noise guard.

    Savings swing wildly with no direction. A straight line can still be
    fitted, and before MIN_R2_FOR_TREND existed this reported a slope and told
    the user their savings were "rising by about N rupees a month". This test
    fails if that guard is removed.
    """
    savings_by_month = [2000, 18000, 1000, 16000, 3000, 15000, 2500]
    rows = []
    for key, saved in zip(
        ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"],
        savings_by_month,
    ):
        rows += month_of(key, 40000, 40000 - saved)

    result = savings.predict(rows)
    assert result["fitted_r2"] is not None and result["fitted_r2"] < savings.MIN_R2_FOR_TREND
    assert result["method"] == "average", "a line that explains nothing must not be projected"
    assert result["slope_per_month"] == 0.0
    assert "vary too much" in result["explanation"]
    # Still a usable number -- it falls back, it does not give up.
    assert result["predicted_next"] == pytest.approx(sum(savings_by_month) / 7, abs=1)


def test_too_few_months_falls_back_to_an_average_and_says_so():
    rows = month_of("2026-01", 40000, 30000) + month_of("2026-02", 40000, 36000)
    result = savings.predict(rows)
    assert result["method"] == "average"
    assert result["months_of_history"] == 2
    assert result["predicted_next"] == pytest.approx(7000.0)
    assert str(savings.MIN_MONTHS_FOR_TREND) in result["explanation"]


def test_no_history_declines_to_forecast():
    result = savings.predict([])
    assert result["method"] == "insufficient_data"
    assert result["predictions"] == []
    assert result["confidence"] == "none"


def test_the_in_progress_month_is_excluded_from_the_fit(monkeypatch):
    """A partial month is a partial sample and must not tilt the line.

    The current month holds whichever of the salary and the rent has happened
    so far, which is an artefact of the date, not a change in behaviour.
    """
    # Patched on ai.savings, not ai.analytics: savings.py imports the name, so
    # it holds its own reference and patching the source module misses it.
    monkeypatch.setattr(savings, "is_current_month", lambda key: key == "2026-05")

    rows = []
    for key in ["2026-01", "2026-02", "2026-03", "2026-04"]:
        rows += month_of(key, 40000, 30000)
    # May so far: the salary has not landed, so "savings" look like -2000.
    rows += [txn("2026-05-02", 2000, "Food")]

    result = savings.predict(rows)
    assert result["months_of_history"] == 4
    assert [m["month"] for m in result["history"]][-1] == "2026-04"
    assert result["predicted_next"] == pytest.approx(10000.0), (
        "the partial month leaked into the forecast"
    )


def test_horizon_is_clamped_to_the_documented_maximum():
    rows = []
    for key in ["2026-01", "2026-02", "2026-03", "2026-04"]:
        rows += month_of(key, 40000, 30000)
    assert len(savings.predict(rows, horizon=99)["predictions"]) == savings.MAX_HORIZON


def test_a_forecast_always_carries_its_disclaimer():
    assert "not a guarantee" in savings.predict([])["disclaimer"]


# --------------------------------------------------------------------------
# project_goal()
# --------------------------------------------------------------------------

from datetime import date  # noqa: E402  (kept beside the tests that use it)

TODAY = date(2026, 11, 4)


def test_goal_eta_is_the_remaining_amount_over_the_monthly_rate():
    goal = {"id": 1, "name": "Laptop", "remaining": 20000, "target_date": None}
    out = savings.project_goal(goal, 5000, today=TODAY)
    assert out["months_needed"] == 4
    assert out["eta"] == "2027-03-01"
    assert out["status"] == "on_track"


def test_a_part_month_rounds_up_rather_than_down():
    """10,500 at 5,000 a month is three months, not two.

    Rounding down would promise the goal is funded a month before it is.
    """
    goal = {"id": 1, "name": "Phone", "remaining": 10500, "target_date": None}
    assert savings.project_goal(goal, 5000, today=TODAY)["months_needed"] == 3


def test_a_goal_behind_its_target_date_says_what_would_be_needed():
    goal = {"id": 1, "name": "Trip", "remaining": 60000, "target_date": "2027-02-01"}
    out = savings.project_goal(goal, 5000, today=TODAY)
    assert out["status"] == "behind"
    assert out["months_left"] == 3
    assert out["required_monthly"] == pytest.approx(20000.0)
    assert "20,000" in out["note"]


def test_zero_savings_gives_no_estimate_rather_than_infinity():
    goal = {"id": 1, "name": "Trip", "remaining": 60000, "target_date": None}
    out = savings.project_goal(goal, 0, today=TODAY)
    assert out["reachable"] is False
    assert out["months_needed"] is None
    # The distinction matters: a missing estimate is not a prediction of never.
    assert "not a prediction" in out["note"]


def test_a_funded_goal_is_reported_as_achieved():
    out = savings.project_goal({"id": 1, "name": "Done", "remaining": 0}, 5000, today=TODAY)
    assert out["status"] == "achieved"
    assert out["months_needed"] == 0


# --------------------------------------------------------------------------
# anomaly.detect()
# --------------------------------------------------------------------------

@pytest.fixture
def spending():
    """Routine food and shopping, plus one 52,000 rupee laptop."""
    rows = []
    row_id = 0
    for month in ["2026-06", "2026-07", "2026-08"]:
        for day, amount in [(3, 450), (7, 520), (11, 380), (15, 610), (19, 490), (23, 540)]:
            row_id += 1
            rows.append(txn(f"{month}-{day:02d}", amount, "Food", row_id=row_id))
        for day, amount in [(5, 1200), (18, 1500), (27, 1350)]:
            row_id += 1
            rows.append(txn(f"{month}-{day:02d}", amount, "Shopping", row_id=row_id))
    rows.append(txn("2026-07-14", 52000, "Shopping", row_id=999))
    return rows


def test_the_outlier_is_found_and_the_routine_rows_are_not(spending):
    result = anomaly.detect(spending, month=None)
    assert [a["id"] for a in result["anomalies"]] == [999]
    assert result["anomalies"][0]["amount"] == 52000.0
    assert result["anomalies"][0]["severity"] == "high"


def test_a_normal_swiggy_order_is_never_flagged(spending):
    """The plan's explicit acceptance case: a 400 rupee food order is fine."""
    spending.append(txn("2026-08-28", 400, "Food", row_id=1000))
    flagged = {a["id"] for a in anomaly.detect(spending, month=None)["anomalies"]}
    assert 1000 not in flagged


def test_an_unusual_but_small_amount_is_not_worth_an_alert(spending):
    """The MIN_EXCESS_RUPEES guard, from a real false positive.

    A tightly clustered category gives MAD a tiny value, so a modestly larger
    bill scores several modified z-scores and used to be reported. 1,019 rupees
    above usual is a warm month, not an event. This test fails if the excess
    floor is removed.
    """
    rows = [txn(f"2026-07-{day:02d}", amount, "Utilities", row_id=2000 + day)
            for day, amount in [(2, 840), (5, 850), (9, 860), (14, 845), (20, 855)]]
    rows.append(txn("2026-07-25", 1871, "Utilities", row_id=2099))

    result = anomaly.detect(rows, month=None)
    culprit = next((a for a in result["anomalies"] if a["id"] == 2099), None)
    z = anomaly._robust_z(1871, 850, 10)
    assert z is not None and z > anomaly.Z_THRESHOLD, "fixture must be over the z threshold"
    assert culprit is None, "statistically unusual is not the same as worth reporting"


def test_a_flat_series_still_catches_a_jump():
    """MAD of zero makes the z-score undefined; the multiple takes over."""
    rows = [txn(f"2026-0{m}-05", 1200, "Utilities", row_id=3000 + m) for m in range(1, 7)]
    rows.append(txn("2026-07-05", 9000, "Utilities", row_id=3099))
    result = anomaly.detect(rows, month=None)
    found = next(a for a in result["anomalies"] if a["id"] == 3099)
    assert found["robust_z"] is None
    assert found["method"] == "multiple of a flat series"


def test_unusually_cheap_is_not_an_anomaly():
    rows = [txn(f"2026-07-{day:02d}", 20000, "Housing", row_id=4000 + day)
            for day in [1, 2, 3, 4, 5, 6]]
    rows.append(txn("2026-07-20", 100, "Housing", row_id=4099))
    flagged = {a["id"] for a in anomaly.detect(rows, month=None)["anomalies"]}
    assert 4099 not in flagged, "a cheap month does not need an alert"


def test_nothing_is_ever_labelled_fraud(spending):
    result = anomaly.detect(spending, month=None)
    assert "not fraud" in result["note"]
    for item in result["anomalies"]:
        assert item["needs_review"] is True
        assert "fraud" not in item["reason"].lower()


def test_every_anomaly_explains_itself_with_real_numbers(spending):
    for item in anomaly.detect(spending, month=None)["anomalies"]:
        assert f"{item['amount']:,.0f}" in item["reason"]
        assert item["times_typical"] > 1
        assert item["typical"] > 0


def test_month_filter_narrows_the_report_but_not_the_statistics(spending):
    """Normality is learned from everything; only the report is scoped."""
    june = anomaly.detect(spending, month="2026-06")
    july = anomaly.detect(spending, month="2026-07")
    assert june["count"] == 0
    assert july["count"] == 1
    # Both looked at the same history to decide what normal is.
    assert june["examined"] == july["examined"] == len(spending)
    assert june["all_time_count"] == july["all_time_count"] == 1


def test_detection_is_deterministic(spending):
    """A detector whose findings change on refresh is not one anyone can trust."""
    first = anomaly.detect(spending, month=None)["anomalies"]
    second = anomaly.detect(spending, month=None)["anomalies"]
    assert [a["id"] for a in first] == [a["id"] for a in second]
    assert [a["forest_agrees"] for a in first] == [a["forest_agrees"] for a in second]


def test_an_empty_history_is_handled():
    result = anomaly.detect([], month=None)
    assert result["anomalies"] == []
    assert result["examined"] == 0
    assert result["forest_used"] is False


def test_the_forest_is_skipped_on_a_small_sample():
    rows = [txn("2026-07-01", 500, "Food", row_id=1)]
    assert anomaly.detect(rows, month=None)["forest_used"] is False


def test_income_is_not_examined():
    """A large salary is not a spending anomaly."""
    rows = [txn(f"2026-0{m}-01", 40000, "Salary", "income", row_id=m) for m in range(1, 8)]
    rows.append(txn("2026-08-01", 400000, "Salary", "income", row_id=99))
    result = anomaly.detect(rows, month=None)
    assert result["examined"] == 0
    assert result["anomalies"] == []
