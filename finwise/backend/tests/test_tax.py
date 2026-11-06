"""Tax Regime Estimator tests for Indian FY 2024-25 / 2025-26."""
import pytest


def register(client, email="tax@example.com", password="password123"):
    return client.post("/api/register",
                       json={"email": email, "password": password, "name": "Tax User"})


@pytest.fixture
def signed_in(client):
    register(client)
    return client


def test_tax_estimator_requires_session(client):
    assert client.get("/api/tax/estimate").status_code == 401


def test_zero_tax_under_new_regime_rebate_limit(signed_in):
    # ₹7,50,000 income - ₹75,000 std deduction = ₹6,75,000 taxable -> eligible for 87A rebate
    res = signed_in.get("/api/tax/estimate?gross_income=750000").get_json()
    assert res["gross_income"] == 750000.0
    assert res["new_regime"]["total_tax"] == 0.0
    assert res["recommendation"]["preferred"] in ["new", "equal"]


def test_comparison_with_deductions(signed_in):
    # ₹15,00,000 gross salary with 80C, 80D, and home loan interest
    qs = "gross_income=1500000&sec_80c=150000&sec_80d=50000&sec_24b=200000"
    res = signed_in.get(f"/api/tax/estimate?{qs}").get_json()

    assert res["gross_income"] == 1500000.0
    assert res["old_regime"]["total_deductions"] == 450000.0  # 50k std + 150k + 50k + 200k
    assert res["new_regime"]["standard_deduction"] == 75000.0
    assert "total_tax" in res["old_regime"]
    assert "total_tax" in res["new_regime"]
    assert res["recommendation"]["preferred"] in ["new", "old"]
