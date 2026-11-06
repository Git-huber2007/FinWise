"""Subscriptions and recurring bills tests, through the HTTP layer."""
from datetime import date, timedelta
import pytest


def register(client, email="subs@example.com", password="password123"):
    return client.post("/api/register",
                       json={"email": email, "password": password, "name": "Subs User"})


@pytest.fixture
def signed_in(client):
    register(client)
    return client


def test_every_subscription_endpoint_requires_a_session(client):
    assert client.get("/api/subscriptions").status_code == 401
    assert client.post("/api/subscriptions", json={"amount": 100}).status_code == 401
    assert client.put("/api/subscriptions/1", json={"amount": 100}).status_code == 401
    assert client.delete("/api/subscriptions/1").status_code == 401
    assert client.post("/api/subscriptions/1/mark-paid", json={}).status_code == 401


def test_another_users_subscription_does_not_exist(client):
    register(client, "owner_sub@example.com")
    today = date.today().isoformat()
    created = client.post("/api/subscriptions", json={
        "name": "Netflix", "amount": 649, "category": "Entertainment",
        "billing_cycle": "monthly", "next_billing_date": today,
    }).get_json()
    client.post("/api/logout")

    register(client, "intruder_sub@example.com")
    # 404 rather than 403 so existence is not leaked
    assert client.put(f"/api/subscriptions/{created['id']}", json={"amount": 100}).status_code == 404
    assert client.delete(f"/api/subscriptions/{created['id']}").status_code == 404
    assert client.post(f"/api/subscriptions/{created['id']}/mark-paid").status_code == 404
    assert client.get("/api/subscriptions").get_json()["subscriptions"] == []


def test_create_and_list_subscriptions(signed_in):
    today = date.today()
    in_3_days = (today + timedelta(days=3)).isoformat()
    in_20_days = (today + timedelta(days=20)).isoformat()

    res1 = signed_in.post("/api/subscriptions", json={
        "name": "Spotify Premium", "amount": 119, "category": "Entertainment",
        "billing_cycle": "monthly", "next_billing_date": in_3_days,
        "payment_method": "UPI",
    })
    assert res1.status_code == 201

    res2 = signed_in.post("/api/subscriptions", json={
        "name": "Amazon Prime", "amount": 1499, "category": "Shopping",
        "billing_cycle": "yearly", "next_billing_date": in_20_days,
    })
    assert res2.status_code == 201

    data = signed_in.get("/api/subscriptions").get_json()
    assert len(data["subscriptions"]) == 2
    assert data["summary"]["active_count"] == 2
    # 119 + 1499/12 (~124.92) = ~243.92
    assert data["summary"]["total_monthly"] > 200
    assert data["summary"]["due_soon_count"] == 1  # Spotify in 3 days


def test_mark_paid_advances_date_and_records_transaction(signed_in):
    today = date.today()
    created = signed_in.post("/api/subscriptions", json={
        "name": "Jio Fiber", "amount": 799, "category": "Utilities",
        "billing_cycle": "monthly", "next_billing_date": today.isoformat(),
        "payment_method": "Auto Debit",
    }).get_json()
    sub_id = created["id"]

    res = signed_in.post(f"/api/subscriptions/{sub_id}/mark-paid", json={"log_transaction": True})
    assert res.status_code == 200
    payload = res.get_json()
    assert payload["transaction_logged"] is True

    # Check next billing date advanced forward
    next_date = date.fromisoformat(payload["subscription"]["next_billing_date"])
    assert next_date > today

    # Verify transaction appeared in ledger
    txns = signed_in.get("/api/transactions").get_json()["transactions"]
    assert any("Jio Fiber" in t["description"] and t["amount"] == 799.0 for t in txns)


def test_validation_rejects_invalid_subscription(signed_in):
    # Missing required name
    res = signed_in.post("/api/subscriptions", json={
        "amount": 200, "next_billing_date": "2026-11-20",
    })
    assert res.status_code == 400

    # Negative amount
    res2 = signed_in.post("/api/subscriptions", json={
        "name": "Invalid", "amount": -50, "next_billing_date": "2026-11-20",
    })
    assert res2.status_code == 400

    # Invalid billing cycle
    res3 = signed_in.post("/api/subscriptions", json={
        "name": "Invalid", "amount": 100, "billing_cycle": "decennially",
        "next_billing_date": "2026-11-20",
    })
    assert res3.status_code == 400

