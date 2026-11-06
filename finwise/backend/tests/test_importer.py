"""Bank Statement CSV Importer & Auto-Categorizer tests."""
import pytest


def register(client, email="importer@example.com", password="password123"):
    return client.post("/api/register",
                       json={"email": email, "password": password, "name": "Import User"})


@pytest.fixture
def signed_in(client):
    register(client)
    return client


CSV_PAYLOAD = """Date,Description,Amount,Type
2026-10-01,Swiggy online food order,450.00,Debit
2026-10-02,Monthly Salary Credit from ACME Inc,75000.00,Credit
2026-10-03,Uber ride to airport,620.00,Debit
"""


def test_import_endpoints_require_session(client):
    assert client.post("/api/import/preview", json={"csv_data": CSV_PAYLOAD}).status_code == 401
    assert client.post("/api/import/commit", json={"rows": []}).status_code == 401


def test_preview_and_commit_csv(signed_in):
    # Preview step
    res_preview = signed_in.post("/api/import/preview", json={"csv_data": CSV_PAYLOAD})
    assert res_preview.status_code == 200
    preview_data = res_preview.get_json()
    assert preview_data["total_rows"] == 3
    assert len(preview_data["rows"]) == 3

    # Check auto-categorization
    rows = preview_data["rows"]
    # Check that predictions exist and rows are classified
    for r in rows:
        assert "predicted_category" in r
        assert "confidence" in r
        assert r["amount"] > 0

    # Commit step
    res_commit = signed_in.post("/api/import/commit", json={"rows": rows})
    assert res_commit.status_code == 201
    commit_data = res_commit.get_json()
    assert commit_data["inserted_count"] == 3

    # Verify they appear in the user's ledger
    txns = signed_in.get("/api/transactions").get_json()["transactions"]
    assert len(txns) == 3
    descriptions = [t["description"] for t in txns]
    assert "Swiggy online food order" in descriptions
    assert "Monthly Salary Credit from ACME Inc" in descriptions

