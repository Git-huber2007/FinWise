"""Tests for the AI categorizer and its endpoints."""
import pytest

from ai import categorizer
from constants import CATEGORIES, CONFIDENCE_FLOOR


@pytest.fixture(scope="module", autouse=True)
def trained_model():
    """Train once for the whole module rather than per test."""
    categorizer.retrain()
    yield
    categorizer.retrain()  # restore a clean model for anything that follows


# --------------------------------------------------------------------------
# Model quality -- measured, not asserted as a claim
# --------------------------------------------------------------------------

def test_holdout_accuracy_beats_chance_by_a_wide_margin():
    """11 classes, so chance is ~9%. This guards against silent regression."""
    metrics = categorizer.evaluate()
    assert metrics["accuracy"] > 0.55, f"held-out accuracy regressed: {metrics['accuracy']:.1%}"
    assert metrics["test_size"] > 100


def test_realistic_phrasings_are_classified_correctly():
    """Full sentences containing known merchants - what users actually type."""
    metrics = categorizer.evaluate_realistic()
    assert metrics["accuracy"] >= 0.90, f"misses: {metrics['misses']}"


def test_eval_set_does_not_leak_into_training():
    """evaluate_realistic() raises on overlap; this makes that explicit."""
    seed_texts = set(categorizer.load_seed_corpus()[0])
    import csv

    with categorizer.EVAL_CSV.open(encoding="utf-8") as fh:
        eval_texts = {r["description"].strip() for r in csv.DictReader(fh)}
    assert not (seed_texts & eval_texts), "eval phrases must not appear in training data"


# --------------------------------------------------------------------------
# Prediction behaviour
# --------------------------------------------------------------------------

@pytest.mark.parametrize(
    "description,expected",
    [
        ("Swiggy food order", "Food"),
        ("zomato dinner delivery", "Food"),
        ("uber ride to the airport", "Transportation"),
        ("monthly salary credited", "Salary"),
        ("netflix subscription", "Entertainment"),
        ("apollo pharmacy medicines", "Healthcare"),
        ("house rent for november", "Housing"),
        ("electricity bill payment", "Utilities"),
        ("sip in mutual fund", "Investments"),
        ("bought shoes on myntra", "Shopping"),
        ("college semester fees", "Education"),
    ],
)
def test_predicts_obvious_descriptions(description, expected):
    result = categorizer.predict(description)
    assert result.category == expected, f"{description!r} -> {result.category} ({result.confidence:.0%})"
    assert result.confident


def test_prediction_is_always_a_known_category():
    for text in ["swiggy", "asdkjfh", "", "   ", "12345", "!!!"]:
        assert categorizer.predict(text).category in CATEGORIES


def test_gibberish_is_declined_rather_than_guessed():
    """An honest 'I don't know' beats a confident wrong label."""
    result = categorizer.predict("qwerty zxcvbn plmokn asdfgh")
    assert not result.confident
    assert result.category == "Other"
    assert result.confidence < CONFIDENCE_FLOOR


def test_empty_description_does_not_crash():
    result = categorizer.predict("")
    assert result.category == "Other"
    assert result.confidence == 0.0
    assert not result.confident


def test_alternatives_are_ranked_descending():
    result = categorizer.predict("swiggy order")
    scores = [a["confidence"] for a in result.alternatives]
    assert scores == sorted(scores, reverse=True)
    assert len(result.alternatives) <= 3


def test_confidence_is_a_probability():
    result = categorizer.predict("zomato")
    assert 0.0 <= result.confidence <= 1.0


# --------------------------------------------------------------------------
# Learning from corrections
# --------------------------------------------------------------------------

def test_model_learns_from_user_corrections():
    """The point of the retraining path.

    'chai sutta bar' is not in the seed corpus. We assert the model's opinion
    BEFORE correcting, so the test proves the correction changed something
    rather than confirming what the model already thought.
    """
    phrase = "chai sutta bar"
    before = categorizer.predict(phrase)

    categorizer.retrain(extra=[(phrase, "Entertainment")] * 3)
    after = categorizer.predict(phrase)

    assert after.category == "Entertainment", (
        f"correction did not take: {before.category} -> {after.category}"
    )
    # ...and it must not have destroyed what it already knew.
    assert categorizer.predict("Swiggy food order").category == "Food"


def test_corrections_do_not_replace_the_seed_corpus():
    """A few corrections must nudge the model, not wipe it."""
    categorizer.retrain(extra=[("some random phrase", "Other")])
    for description, expected in [
        ("swiggy", "Food"),
        ("uber", "Transportation"),
        ("netflix", "Entertainment"),
    ]:
        assert categorizer.predict(description).category == expected


# --------------------------------------------------------------------------
# API
# --------------------------------------------------------------------------

def register(client):
    return client.post("/api/register", json={
        "name": "AI Tester", "email": "ai@example.com", "password": "testpass123"})


def test_categorize_endpoint_requires_login(client):
    assert client.post("/api/ai/categorize", json={"description": "swiggy"}).status_code == 401


def test_categorize_endpoint_returns_prediction(client):
    register(client)
    response = client.post("/api/ai/categorize", json={"description": "Swiggy food order"})
    assert response.status_code == 200
    body = response.get_json()
    assert body["category"] == "Food"
    assert body["confident"] is True
    assert 0 <= body["confidence"] <= 1
    assert body["alternatives"]
    assert body["floor"] == CONFIDENCE_FLOOR


def test_categorize_rejects_empty_description(client):
    register(client)
    response = client.post("/api/ai/categorize", json={"description": "   "})
    assert response.status_code == 400
    assert response.get_json()["field"] == "description"


def test_saving_the_suggested_category_is_not_a_correction(client):
    register(client)
    response = client.post("/api/transactions", json={
        "description": "Swiggy food order", "amount": 350, "category": "Food",
        "txn_type": "expense", "date": "2026-10-01",
        "ai_category": "Food", "ai_confidence": 0.98})
    assert response.status_code == 201
    assert response.get_json()["was_corrected"] is False


def test_overriding_the_suggested_category_is_recorded_as_a_correction(client):
    register(client)
    response = client.post("/api/transactions", json={
        "description": "Swiggy food order", "amount": 350, "category": "Shopping",
        "txn_type": "expense", "date": "2026-10-01",
        "ai_category": "Food", "ai_confidence": 0.98})
    assert response.status_code == 201
    body = response.get_json()
    assert body["was_corrected"] is True
    assert body["category"] == "Shopping"
    assert body["ai_category"] == "Food"


def test_editing_a_category_later_also_marks_a_correction(client):
    register(client)
    txn_id = client.post("/api/transactions", json={
        "description": "Swiggy food order", "amount": 350, "category": "Food",
        "txn_type": "expense", "date": "2026-10-01",
        "ai_category": "Food", "ai_confidence": 0.98}).get_json()["id"]

    updated = client.put(f"/api/transactions/{txn_id}", json={"category": "Entertainment"})
    assert updated.get_json()["was_corrected"] is True


def test_stats_endpoint_reports_acceptance(client):
    register(client)
    for category in ["Food", "Food", "Shopping"]:
        client.post("/api/transactions", json={
            "description": "Swiggy food order", "amount": 100, "category": category,
            "txn_type": "expense", "date": "2026-10-01",
            "ai_category": "Food", "ai_confidence": 0.9})

    stats = client.get("/api/ai/categorize/stats").get_json()
    assert stats["predicted"] == 3
    assert stats["corrections"] == 1
    assert stats["acceptance_rate"] == pytest.approx(2 / 3, abs=0.01)


def test_acceptance_rate_is_null_when_nothing_predicted(client):
    """100% on a sample of zero would be a lie."""
    register(client)
    assert client.get("/api/ai/categorize/stats").get_json()["acceptance_rate"] is None


def test_retrain_refuses_below_the_threshold(client):
    register(client)
    response = client.post("/api/ai/categorize/retrain")
    assert response.status_code == 400
    assert "at least" in response.get_json()["error"]


def test_retrain_runs_once_enough_corrections_exist(client):
    register(client)
    for i in range(3):
        client.post("/api/transactions", json={
            "description": f"mystery vendor {i}", "amount": 100, "category": "Education",
            "txn_type": "expense", "date": "2026-10-01",
            "ai_category": "Other", "ai_confidence": 0.5})

    response = client.post("/api/ai/categorize/retrain")
    assert response.status_code == 200
    assert response.get_json()["trained_on_corrections"] == 3
