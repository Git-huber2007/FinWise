"""Budget CRUD tests, through the HTTP layer.

These go through the API rather than calling the module directly because the
things most likely to be wrong here are the boundaries: who owns a row, what a
duplicate means when the column is NULL, and which status code says which
thing.
"""
import pytest


def register(client, email="budget@example.com", password="hunter2hunter2"):
    return client.post("/api/register",
                       json={"email": email, "password": password, "name": "Budget User"})


def add_txn(client, amount, category, date, txn_type="expense"):
    return client.post("/api/transactions", json={
        "description": f"{category} spend", "amount": amount, "category": category,
        "txn_type": txn_type, "date": date,
    })


@pytest.fixture
def signed_in(client):
    register(client)
    return client


# --------------------------------------------------------------------------
# Access control
# --------------------------------------------------------------------------

def test_every_budget_endpoint_requires_a_session(client):
    assert client.get("/api/budgets").status_code == 401
    assert client.post("/api/budgets", json={"amount": 100}).status_code == 401
    assert client.put("/api/budgets/1", json={"amount": 100}).status_code == 401
    assert client.delete("/api/budgets/1").status_code == 401


def test_another_users_budget_does_not_exist(client):
    register(client, "owner@example.com")
    created = client.post("/api/budgets", json={
        "category": "Food", "amount": 5000, "month": 10, "year": 2026}).get_json()
    client.post("/api/logout")

    register(client, "intruder@example.com")
    # 404 rather than 403: a 403 would confirm the row exists.
    assert client.put(f"/api/budgets/{created['id']}", json={"amount": 1}).status_code == 404
    assert client.delete(f"/api/budgets/{created['id']}").status_code == 404
    assert client.get("/api/budgets?month=2026-10").get_json()["budgets"] == []


# --------------------------------------------------------------------------
# Create
# --------------------------------------------------------------------------

def test_create_a_category_budget(signed_in):
    response = signed_in.post("/api/budgets", json={
        "category": "Food", "amount": 9000, "month": 10, "year": 2026})
    assert response.status_code == 201
    body = response.get_json()
    assert body["category"] == "Food"
    assert body["amount"] == 9000.0
    assert body["is_overall"] is False


@pytest.mark.parametrize("category", [None, "", "overall"])
def test_an_absent_or_blank_category_means_the_overall_budget(signed_in, category):
    response = signed_in.post("/api/budgets", json={
        "category": category, "amount": 40000, "month": 10, "year": 2026})
    assert response.status_code == 201
    assert response.get_json()["is_overall"] is True


def test_a_duplicate_overall_budget_is_rejected(signed_in):
    """The NULL-uniqueness trap.

    The table has UNIQUE(user_id, category, month, year), but SQL treats NULLs
    as distinct, so that index does NOT stop a second overall budget -- whose
    category is NULL. Without the explicit check in routes/budgets.py this
    creates a duplicate and every total silently double-counts.
    """
    first = signed_in.post("/api/budgets", json={"amount": 40000, "month": 10, "year": 2026})
    assert first.status_code == 201

    second = signed_in.post("/api/budgets", json={"amount": 35000, "month": 10, "year": 2026})
    assert second.status_code == 409
    assert "already exists" in second.get_json()["error"]

    listed = signed_in.get("/api/budgets?month=2026-10").get_json()
    assert sum(1 for b in listed["budgets"] if b["is_overall"]) == 1


def test_a_duplicate_category_budget_is_rejected(signed_in):
    signed_in.post("/api/budgets", json={
        "category": "Food", "amount": 9000, "month": 10, "year": 2026})
    again = signed_in.post("/api/budgets", json={
        "category": "Food", "amount": 7000, "month": 10, "year": 2026})
    assert again.status_code == 409


def test_the_same_category_in_a_different_month_is_fine(signed_in):
    signed_in.post("/api/budgets", json={
        "category": "Food", "amount": 9000, "month": 10, "year": 2026})
    assert signed_in.post("/api/budgets", json={
        "category": "Food", "amount": 9500, "month": 11, "year": 2026}).status_code == 201
    assert signed_in.post("/api/budgets", json={
        "category": "Food", "amount": 8000, "month": 10, "year": 2027}).status_code == 201


def test_salary_cannot_be_budgeted(signed_in):
    """Budgeting your own salary is nonsense and would sit at 0% used forever."""
    response = signed_in.post("/api/budgets", json={
        "category": "Salary", "amount": 50000, "month": 10, "year": 2026})
    assert response.status_code == 400
    assert response.get_json()["field"] == "category"


def test_investments_can_be_budgeted(signed_in):
    """A monthly SIP is an expense people budget, even though a dividend is income."""
    assert signed_in.post("/api/budgets", json={
        "category": "Investments", "amount": 5000, "month": 10, "year": 2026}).status_code == 201


def test_every_unbudgeted_suggestion_can_actually_be_budgeted(signed_in):
    """Each row carries a "Set a budget" button; none may open a form the API refuses.

    Investments was excluded from BUDGETABLE but appears in expense spending
    (SIPs), so the page offered a button that led straight to a 400.
    """
    from routes.budgets import BUDGETABLE

    add_txn(signed_in, 5000, "Investments", "2026-10-03")
    add_txn(signed_in, 4000, "Shopping", "2026-10-04")

    data = signed_in.get("/api/budgets?month=2026-10").get_json()
    assert data["unbudgeted"], "fixture must produce unbudgeted spending"
    for item in data["unbudgeted"]:
        assert item["category"] in BUDGETABLE, (
            f"{item['category']} is offered but cannot be budgeted"
        )
        created = signed_in.post("/api/budgets", json={
            "category": item["category"], "amount": 1000, "month": 10, "year": 2026})
        assert created.status_code == 201, f"{item['category']} was offered but rejected"


@pytest.mark.parametrize("amount", [0, -100])
def test_a_budget_must_be_a_positive_amount(signed_in, amount):
    response = signed_in.post("/api/budgets", json={
        "category": "Food", "amount": amount, "month": 10, "year": 2026})
    assert response.status_code == 400


def test_an_unknown_category_is_rejected(signed_in):
    response = signed_in.post("/api/budgets", json={
        "category": "Yachts", "amount": 1000, "month": 10, "year": 2026})
    assert response.status_code == 400


@pytest.mark.parametrize("month", [0, 13, -1])
def test_an_impossible_month_is_rejected(signed_in, month):
    response = signed_in.post("/api/budgets", json={
        "category": "Food", "amount": 1000, "month": month, "year": 2026})
    assert response.status_code == 400


# --------------------------------------------------------------------------
# Utilisation
# --------------------------------------------------------------------------

def test_utilisation_reflects_actual_spending(signed_in):
    signed_in.post("/api/budgets", json={
        "category": "Food", "amount": 10000, "month": 10, "year": 2026})
    add_txn(signed_in, 2500, "Food", "2026-10-05")
    add_txn(signed_in, 1500, "Food", "2026-10-12")

    food = signed_in.get("/api/budgets?month=2026-10").get_json()["budgets"][0]
    assert food["spent"] == 4000.0
    assert food["remaining"] == 6000.0
    assert food["used_pct"] == 40.0
    assert food["status"] == "ok"


def test_status_moves_through_ok_warning_and_over(signed_in):
    signed_in.post("/api/budgets", json={
        "category": "Food", "amount": 1000, "month": 10, "year": 2026})

    def status():
        return signed_in.get("/api/budgets?month=2026-10").get_json()["budgets"][0]["status"]

    add_txn(signed_in, 500, "Food", "2026-10-01")
    assert status() == "ok"          # 50%
    add_txn(signed_in, 350, "Food", "2026-10-02")
    assert status() == "warning"     # 85%, at or past the warn threshold
    add_txn(signed_in, 300, "Food", "2026-10-03")
    assert status() == "over"        # 115%


def test_spending_in_another_month_does_not_count(signed_in):
    signed_in.post("/api/budgets", json={
        "category": "Food", "amount": 10000, "month": 10, "year": 2026})
    add_txn(signed_in, 3000, "Food", "2026-09-28")
    add_txn(signed_in, 3000, "Food", "2026-11-02")

    food = signed_in.get("/api/budgets?month=2026-10").get_json()["budgets"][0]
    assert food["spent"] == 0.0


def test_income_does_not_count_against_a_budget(signed_in):
    signed_in.post("/api/budgets", json={
        "category": "Food", "amount": 10000, "month": 10, "year": 2026})
    add_txn(signed_in, 5000, "Food", "2026-10-05")
    add_txn(signed_in, 40000, "Salary", "2026-10-01", txn_type="income")

    data = signed_in.get("/api/budgets?month=2026-10").get_json()
    assert data["budgets"][0]["spent"] == 5000.0


def test_the_overall_budget_counts_every_category(signed_in):
    signed_in.post("/api/budgets", json={"amount": 10000, "month": 10, "year": 2026})
    add_txn(signed_in, 3000, "Food", "2026-10-05")
    add_txn(signed_in, 2000, "Shopping", "2026-10-06")

    overall = signed_in.get("/api/budgets?month=2026-10").get_json()["overall"]
    assert overall["spent"] == 5000.0
    assert overall["used_pct"] == 50.0


def test_unbudgeted_spending_is_reported(signed_in):
    """Otherwise the page implies the budgeted categories are everything."""
    signed_in.post("/api/budgets", json={
        "category": "Food", "amount": 10000, "month": 10, "year": 2026})
    add_txn(signed_in, 3000, "Food", "2026-10-05")
    add_txn(signed_in, 4500, "Shopping", "2026-10-06")
    add_txn(signed_in, 800, "Transportation", "2026-10-07")

    data = signed_in.get("/api/budgets?month=2026-10").get_json()
    unbudgeted = {item["category"]: item["spent"] for item in data["unbudgeted"]}
    assert unbudgeted == {"Shopping": 4500.0, "Transportation": 800.0}
    # Biggest first, so the most worthwhile budget to set is named first.
    assert data["unbudgeted"][0]["category"] == "Shopping"


def test_a_budgeted_category_is_not_offered_again(signed_in):
    before = signed_in.get("/api/budgets?month=2026-10").get_json()["available_categories"]
    assert "Food" in before
    signed_in.post("/api/budgets", json={
        "category": "Food", "amount": 9000, "month": 10, "year": 2026})
    after = signed_in.get("/api/budgets?month=2026-10").get_json()["available_categories"]
    assert "Food" not in after
    assert "Salary" not in after, "income categories are never budgetable"


def test_totals_exclude_the_overall_budget_from_the_budgeted_sum(signed_in):
    """Adding the overall budget to the per-category sum double-counts."""
    signed_in.post("/api/budgets", json={"amount": 30000, "month": 10, "year": 2026})
    signed_in.post("/api/budgets", json={
        "category": "Food", "amount": 9000, "month": 10, "year": 2026})
    signed_in.post("/api/budgets", json={
        "category": "Shopping", "amount": 6000, "month": 10, "year": 2026})

    totals = signed_in.get("/api/budgets?month=2026-10").get_json()["totals"]
    assert totals["budgeted"] == 15000.0


def test_suggested_amounts_use_complete_months_only(signed_in):
    """A budget suggested from a part-month would be a fraction of the truth."""
    for month in ["08", "09"]:
        add_txn(signed_in, 6000, "Food", f"2026-{month}-10")
    typical = signed_in.get("/api/budgets?month=2026-10").get_json()["typical"]
    assert typical["Food"] == 6000.0


# --------------------------------------------------------------------------
# Update and delete
# --------------------------------------------------------------------------

def test_update_changes_the_amount_and_the_utilisation(signed_in):
    created = signed_in.post("/api/budgets", json={
        "category": "Food", "amount": 10000, "month": 10, "year": 2026}).get_json()
    add_txn(signed_in, 5000, "Food", "2026-10-05")

    assert signed_in.put(f"/api/budgets/{created['id']}",
                         json={"amount": 5000}).status_code == 200
    food = signed_in.get("/api/budgets?month=2026-10").get_json()["budgets"][0]
    assert food["amount"] == 5000.0
    assert food["used_pct"] == 100.0
    assert food["remaining"] == 0.0
    # Exactly at the limit is not OVER (that needs >100%), but it is certainly
    # worth flagging -- there is nothing left to spend.
    assert food["status"] == "warning"


def test_update_cannot_collide_with_another_budget(signed_in):
    signed_in.post("/api/budgets", json={
        "category": "Food", "amount": 9000, "month": 10, "year": 2026})
    shopping = signed_in.post("/api/budgets", json={
        "category": "Shopping", "amount": 6000, "month": 10, "year": 2026}).get_json()

    collision = signed_in.put(f"/api/budgets/{shopping['id']}", json={"category": "Food"})
    assert collision.status_code == 409


def test_a_budget_can_be_retargeted_to_a_free_category(signed_in):
    created = signed_in.post("/api/budgets", json={
        "category": "Food", "amount": 9000, "month": 10, "year": 2026}).get_json()
    response = signed_in.put(f"/api/budgets/{created['id']}", json={"category": "Shopping"})
    assert response.status_code == 200
    assert response.get_json()["category"] == "Shopping"


def test_delete_removes_only_that_budget(signed_in):
    food = signed_in.post("/api/budgets", json={
        "category": "Food", "amount": 9000, "month": 10, "year": 2026}).get_json()
    signed_in.post("/api/budgets", json={
        "category": "Shopping", "amount": 6000, "month": 10, "year": 2026})

    assert signed_in.delete(f"/api/budgets/{food['id']}").status_code == 200
    remaining = signed_in.get("/api/budgets?month=2026-10").get_json()["budgets"]
    assert [b["category"] for b in remaining] == ["Shopping"]


def test_deleting_a_budget_leaves_the_transactions_alone(signed_in):
    created = signed_in.post("/api/budgets", json={
        "category": "Food", "amount": 9000, "month": 10, "year": 2026}).get_json()
    add_txn(signed_in, 2500, "Food", "2026-10-05")

    signed_in.delete(f"/api/budgets/{created['id']}")
    assert signed_in.get("/api/transactions").get_json()["total"] == 1


def test_the_duplicate_message_is_grammatical(signed_in):
    """It read "A overall budget already exists"."""
    signed_in.post("/api/budgets", json={"amount": 40000, "month": 10, "year": 2026})
    overall = signed_in.post("/api/budgets", json={"amount": 1, "month": 10, "year": 2026})
    assert overall.get_json()["error"].startswith("An overall budget")

    signed_in.post("/api/budgets", json={
        "category": "Food", "amount": 9000, "month": 10, "year": 2026})
    food = signed_in.post("/api/budgets", json={
        "category": "Food", "amount": 1, "month": 10, "year": 2026})
    assert food.get_json()["error"].startswith("A Food budget")
