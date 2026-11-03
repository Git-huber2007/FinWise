"""API-level tests for authentication, validation and user isolation."""
from sqlalchemy import select

from models import Transaction, User, db


def register(client, email="new@example.com", password="hunter2hunter2", name="New User"):
    return client.post("/api/register", json={"email": email, "password": password, "name": name})


def login(client, email="new@example.com", password="hunter2hunter2"):
    return client.post("/api/login", json={"email": email, "password": password})


def make_txn(client, **overrides):
    payload = {
        "description": "Swiggy order",
        "amount": 349.50,
        "category": "Food",
        "txn_type": "expense",
        "date": "2026-05-09",
        "payment_method": "UPI",
    }
    payload.update(overrides)
    return client.post("/api/transactions", json=payload)


# --------------------------------------------------------------------------
# Registration and login
# --------------------------------------------------------------------------

def test_register_creates_user_and_logs_in(client):
    response = register(client)
    assert response.status_code == 201
    body = response.get_json()
    assert body["user"]["email"] == "new@example.com"
    assert "password" not in str(body)
    # The session is live immediately after registering.
    assert client.get("/api/me").status_code == 200


def test_register_rejects_duplicate_email(client):
    register(client)
    response = register(client)
    assert response.status_code == 409
    assert response.get_json()["field"] == "email"


def test_register_rejects_short_password(client):
    response = register(client, password="short")
    assert response.status_code == 400
    assert response.get_json()["field"] == "password"


def test_register_rejects_malformed_email(client):
    response = register(client, email="not-an-email")
    assert response.status_code == 400
    assert response.get_json()["field"] == "email"


def test_password_is_never_stored_in_plain_text(client, app):
    register(client)
    stored = db.session.scalar(select(User).where(User.email == "new@example.com"))
    assert stored is not None, "the user we just registered should exist"
    assert "hunter2hunter2" not in stored.password_hash


def test_login_with_wrong_password_is_rejected(client):
    register(client)
    client.post("/api/logout")
    assert login(client, password="wrong-password-entirely").status_code == 401


def test_unknown_and_wrong_password_give_the_same_message(client):
    """Otherwise the response reveals which emails are registered."""
    register(client)
    client.post("/api/logout")
    wrong_pw = login(client, password="wrong-password-entirely")
    no_user = login(client, email="nobody@example.com", password="wrong-password-entirely")
    assert wrong_pw.status_code == no_user.status_code == 401
    assert wrong_pw.get_json()["error"] == no_user.get_json()["error"]


def test_logout_ends_the_session(client):
    register(client)
    assert client.post("/api/logout").status_code == 200
    assert client.get("/api/me").status_code == 401


def test_logout_also_revokes_the_remember_me_cookie(client):
    """Regression: logout must not leave a usable remember-me cookie.

    We log in with remember=True, so Flask-Login issues a second cookie that
    can re-authenticate a request on its own. logout_user() marks it for
    deletion by writing session["_remember"]="clear"; calling session.clear()
    *after* logout_user() erases that mark and the cookie survives.

    The plain logout test above does NOT catch this -- it passes against the
    broken code -- so this asserts on the cookie itself rather than on one
    request's status.
    """
    register(client)
    assert any(c.key == "remember_token" for c in client._cookies.values()), (
        "precondition failed: no remember_token was issued, so this test "
        "cannot prove anything about revoking it"
    )

    client.post("/api/logout")

    remaining = [c for c in client._cookies.values() if c.key == "remember_token" and c.value]
    assert not remaining, "remember_token survived logout and can re-authenticate"
    assert client.get("/api/me").status_code == 401
    assert client.get("/api/transactions").status_code == 401


# --------------------------------------------------------------------------
# Protected routes
# --------------------------------------------------------------------------

def test_protected_routes_401_when_anonymous(client):
    for method, path in [
        ("get", "/api/me"),
        ("get", "/api/transactions"),
        ("post", "/api/transactions"),
        ("put", "/api/transactions/1"),
        ("delete", "/api/transactions/1"),
    ]:
        response = getattr(client, method)(path, json={})
        assert response.status_code == 401, f"{method.upper()} {path}"
        assert response.get_json()["error"] == "authentication required"


# --------------------------------------------------------------------------
# Transaction CRUD
# --------------------------------------------------------------------------

def test_create_read_update_delete(client):
    register(client)

    created = make_txn(client)
    assert created.status_code == 201
    txn_id = created.get_json()["id"]
    assert created.get_json()["amount"] == 349.50

    listed = client.get("/api/transactions").get_json()
    assert listed["total"] == 1
    assert listed["totals"]["expense"] == 349.50

    updated = client.put(f"/api/transactions/{txn_id}", json={"amount": 500, "category": "Shopping"})
    assert updated.status_code == 200
    assert updated.get_json()["amount"] == 500.0
    assert updated.get_json()["category"] == "Shopping"

    assert client.delete(f"/api/transactions/{txn_id}").status_code == 200
    assert client.get("/api/transactions").get_json()["total"] == 0


def test_amount_keeps_two_decimal_places_through_the_api(client):
    register(client)
    body = make_txn(client, amount="1234.56").get_json()
    assert body["amount"] == 1234.56


def test_rejects_zero_and_negative_amounts(client):
    register(client)
    for bad in (0, -100):
        response = make_txn(client, amount=bad)
        assert response.status_code == 400
        assert response.get_json()["field"] == "amount"


def test_rejects_unknown_category_and_type(client):
    register(client)
    assert make_txn(client, category="Crypto").get_json()["field"] == "category"
    assert make_txn(client, txn_type="refund").get_json()["field"] == "txn_type"


def test_rejects_malformed_date(client):
    register(client)
    response = make_txn(client, date="09-05-2026")
    assert response.status_code == 400
    assert response.get_json()["field"] == "date"


def test_missing_description_is_rejected(client):
    register(client)
    response = client.post("/api/transactions", json={"amount": 10, "category": "Food",
                                                      "txn_type": "expense"})
    assert response.status_code == 400
    assert response.get_json()["field"] == "description"


def test_non_json_body_is_a_400_not_a_500(client):
    register(client)
    response = client.post("/api/transactions", data="not json",
                           content_type="text/plain")
    assert response.status_code == 400


# --------------------------------------------------------------------------
# User isolation -- the core security property
# --------------------------------------------------------------------------

def test_one_user_cannot_read_update_or_delete_anothers_transaction(client, app):
    register(client, email="asha@example.com")
    asha_txn_id = make_txn(client, description="Asha's private lunch").get_json()["id"]
    client.post("/api/logout")

    register(client, email="vikram@example.com")

    # Not in the list...
    listing = client.get("/api/transactions").get_json()
    assert listing["total"] == 0

    # ...and not reachable by id, in any verb. 404, not 403: a 403 would
    # confirm the row exists.
    assert client.put(f"/api/transactions/{asha_txn_id}", json={"amount": 1}).status_code == 404
    assert client.delete(f"/api/transactions/{asha_txn_id}").status_code == 404

    # And it genuinely still exists -- the 404 was authorization, not absence.
    assert db.session.get(Transaction, asha_txn_id) is not None


def test_search_and_filters(client):
    register(client)
    make_txn(client, description="Swiggy dinner", category="Food", amount=400,
             date="2026-05-02")
    make_txn(client, description="Uber to campus", category="Transportation", amount=180,
             date="2026-05-15")
    make_txn(client, description="Monthly salary", category="Salary", amount=45000,
             txn_type="income", date="2026-05-01")

    assert client.get("/api/transactions?search=swiggy").get_json()["total"] == 1
    assert client.get("/api/transactions?category=Transportation").get_json()["total"] == 1
    assert client.get("/api/transactions?txn_type=income").get_json()["total"] == 1
    assert client.get("/api/transactions?start_date=2026-05-10").get_json()["total"] == 1
    assert client.get("/api/transactions?end_date=2026-05-05").get_json()["total"] == 2

    totals = client.get("/api/transactions").get_json()["totals"]
    assert totals["income"] == 45000.0
    assert totals["expense"] == 580.0
    assert totals["net"] == 44420.0


def test_search_treats_percent_as_a_literal_not_a_wildcard(client):
    register(client)
    make_txn(client, description="50% cashback offer")
    make_txn(client, description="Ordinary lunch")
    # If % were passed through to LIKE, this would match both rows.
    assert client.get("/api/transactions?search=%25").get_json()["total"] == 1


def test_totals_cover_the_whole_filtered_set_not_just_the_page(client):
    register(client)
    for i in range(5):
        make_txn(client, amount=100, description=f"item {i}")
    body = client.get("/api/transactions?limit=2").get_json()
    assert len(body["transactions"]) == 2
    assert body["total"] == 5
    assert body["totals"]["expense"] == 500.0


# --------------------------------------------------------------------------
# Profile
# --------------------------------------------------------------------------

def test_update_profile_and_preferences(client):
    register(client)
    response = client.put("/api/me", json={"name": "Asha R", "monthly_income": 52000,
                                           "emergency_fund": 100000, "theme": "light"})
    assert response.status_code == 200
    body = response.get_json()
    assert body["user"]["name"] == "Asha R"
    assert body["user"]["monthly_income"] == 52000.0
    assert body["preferences"]["theme"] == "light"


def test_negative_income_is_rejected(client):
    register(client)
    response = client.put("/api/me", json={"monthly_income": -5})
    assert response.status_code == 400
    assert response.get_json()["field"] == "monthly_income"


def test_password_change_requires_the_current_password(client):
    register(client)
    assert client.put("/api/me/password", json={"current_password": "nope",
                                                "new_password": "brandnewpass"}).status_code == 401
    assert client.put("/api/me/password", json={"current_password": "hunter2hunter2",
                                                "new_password": "brandnewpass"}).status_code == 200
    client.post("/api/logout")
    assert login(client, password="brandnewpass").status_code == 200
