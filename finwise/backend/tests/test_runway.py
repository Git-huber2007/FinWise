"""Emergency Runway & Financial Safety Simulator tests."""
import pytest


def register(client, email="runway@example.com", password="password123"):
    return client.post("/api/register",
                       json={"email": email, "password": password, "name": "Runway User"})


@pytest.fixture
def signed_in(client):
    register(client)
    return client


def test_runway_requires_session(client):
    assert client.get("/api/ai/runway").status_code == 401


def test_runway_calculation_with_assets_and_txns(signed_in):
    # Add liquid asset
    signed_in.post("/api/net-worth/assets", json={
        "name": "Emergency Fund in HDFC",
        "asset_type": "bank",
        "balance": 180000.0,
    })

    # Add transactions to define burn
    signed_in.post("/api/transactions", json={
        "date": "2026-10-01",
        "category": "Rent & Housing",
        "description": "Apartment Rent",
        "amount": 25000.0,
        "txn_type": "expense",
    })
    signed_in.post("/api/transactions", json={
        "date": "2026-10-02",
        "category": "Groceries",
        "description": "Supermarket supplies",
        "amount": 5000.0,
        "txn_type": "expense",
    })

    res = signed_in.get("/api/ai/runway").get_json()
    assert res["liquid_reserves"] >= 180000.0
    assert "simulated" in res
    assert res["simulated"]["runway_months"] >= 0
    assert "scenarios" in res
    assert len(res["scenarios"]) == 4

    # Test override through POST
    custom = signed_in.post("/api/ai/runway", json={
        "custom_liquid_reserves": 300000.0,
        "custom_monthly_burn": 30000.0,
    }).get_json()
    assert custom["simulated"]["liquid"] == 300000.0
    assert custom["simulated"]["burn"] == 30000.0
    assert custom["simulated"]["runway_months"] == 10.0
