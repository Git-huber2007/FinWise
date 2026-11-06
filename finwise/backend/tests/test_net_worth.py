"""Net Worth & Asset/Liability tests, verifying calculations and user scoping."""
import pytest


def register(client, email="nw@example.com", password="password123"):
    return client.post("/api/register",
                       json={"email": email, "password": password, "name": "NetWorth User"})


@pytest.fixture
def signed_in(client):
    register(client)
    return client


def test_net_worth_requires_session(client):
    assert client.get("/api/net-worth").status_code == 401
    assert client.post("/api/net-worth/assets", json={"name": "Cash", "balance": 1000}).status_code == 401


def test_asset_lifecycle_and_net_worth_calculation(signed_in):
    # Empty at start
    res = signed_in.get("/api/net-worth").get_json()
    assert res["summary"]["total_assets"] == 0
    assert res["summary"]["total_liabilities"] == 0
    assert res["summary"]["net_worth"] == 0

    # Add Cash Asset
    res1 = signed_in.post("/api/net-worth/assets", json={
        "name": "HDFC Savings",
        "asset_type": "bank",
        "balance": 150000.0,
        "institution": "HDFC Bank",
    })
    assert res1.status_code == 201
    asset_id = res1.get_json()["id"]

    # Add Mutual Funds
    res2 = signed_in.post("/api/net-worth/assets", json={
        "name": "Nifty 50 Index Fund",
        "asset_type": "investment",
        "balance": 250000.0,
        "institution": "Zerodha Coin",
    })
    assert res2.status_code == 201

    # Check updated Net Worth
    res = signed_in.get("/api/net-worth").get_json()
    assert res["summary"]["total_assets"] == 400000.0
    assert res["summary"]["liquid_assets"] == 150000.0
    assert res["summary"]["net_worth"] == 400000.0

    # Edit asset
    res_edit = signed_in.put(f"/api/net-worth/assets/{asset_id}", json={
        "name": "HDFC Savings Main",
        "asset_type": "bank",
        "balance": 180000.0,
    })
    assert res_edit.status_code == 200
    assert res_edit.get_json()["balance"] == 180000.0

    # Delete asset
    del_res = signed_in.delete(f"/api/net-worth/assets/{asset_id}")
    assert del_res.status_code == 200

    # Verify updated total
    res = signed_in.get("/api/net-worth").get_json()
    assert res["summary"]["total_assets"] == 250000.0


def test_user_scoping_for_assets(client):
    register(client, "user1@example.com")
    c1 = client.post("/api/net-worth/assets", json={
        "name": "Private Gold",
        "asset_type": "gold",
        "balance": 90000.0,
    }).get_json()["id"]
    client.post("/api/logout")

    register(client, "user2@example.com")
    assert client.put(f"/api/net-worth/assets/{c1}", json={"balance": 100}).status_code == 404
    assert client.delete(f"/api/net-worth/assets/{c1}").status_code == 404
    assert client.get("/api/net-worth").get_json()["assets"] == []
