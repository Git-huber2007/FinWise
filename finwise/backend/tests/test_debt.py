"""Debt Payoff & Snowball/Avalanche Planner tests."""
import pytest


def register(client, email="debt@example.com", password="password123"):
    return client.post("/api/register",
                       json={"email": email, "password": password, "name": "Debt User"})


@pytest.fixture
def signed_in(client):
    register(client)
    return client


def test_debt_endpoints_require_session(client):
    assert client.get("/api/debt").status_code == 401
    assert client.post("/api/debt", json={"name": "Card", "balance": 1000}).status_code == 401


def test_debt_lifecycle_and_strategies(signed_in):
    # Add Credit Card Debt (High interest: 36%)
    res1 = signed_in.post("/api/debt", json={
        "name": "HDFC Millennia Card",
        "debt_type": "credit_card",
        "principal_amount": 50000.0,
        "current_balance": 35000.0,
        "interest_rate": 36.0,
        "minimum_payment": 2000.0,
        "due_day": 15,
        "institution": "HDFC",
    })
    assert res1.status_code == 201
    card_id = res1.get_json()["id"]

    # Add Personal Loan (Medium interest: 13.5%)
    res2 = signed_in.post("/api/debt", json={
        "name": "Axis Personal Loan",
        "debt_type": "personal_loan",
        "principal_amount": 100000.0,
        "current_balance": 80000.0,
        "interest_rate": 13.5,
        "minimum_payment": 3500.0,
        "due_day": 5,
        "institution": "Axis Bank",
    })
    assert res2.status_code == 201

    # Fetch debt overview with standard minimum payment
    plan = signed_in.get("/api/debt").get_json()
    assert plan["summary"]["total_debt"] == 115000.0
    assert plan["summary"]["total_monthly_emi"] == 5500.0
    assert "avalanche" in plan["simulation"]
    assert "snowball" in plan["simulation"]

    # Test with extra monthly payment (e.g. ₹5,000 extra)
    boosted = signed_in.get("/api/debt?extra_monthly=5000").get_json()
    assert boosted["simulation"]["extra_monthly"] == 5000.0
    # Avalanche should finish in fewer months or with lower interest than baseline
    assert boosted["simulation"]["avalanche"]["total_interest"] <= plan["simulation"]["avalanche"]["total_interest"]

    # Update debt balance
    res_put = signed_in.put(f"/api/debt/{card_id}", json={
        "name": "HDFC Millennia Card",
        "debt_type": "credit_card",
        "current_balance": 25000.0,
        "interest_rate": 36.0,
        "minimum_payment": 2000.0,
    })
    assert res_put.status_code == 200
    assert res_put.get_json()["current_balance"] == 25000.0

    # Delete debt
    assert signed_in.delete(f"/api/debt/{card_id}").status_code == 200
    plan_after = signed_in.get("/api/debt").get_json()
    assert plan_after["summary"]["total_debt"] == 80000.0
