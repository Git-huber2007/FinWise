"""AI Assistant tests.

The rule engine is tested hardest. It is not a degraded stub -- it runs
whenever Gemini is absent, slow, broken or out of quota, so it is the
correctness floor of the feature.
"""
import pytest

from ai import chat


def txn(date, amount, category, txn_type="expense"):
    return {"id": abs(hash((date, amount, category))) % 100000,
            "date": date, "amount": float(amount),
            "category": category, "txn_type": txn_type}


@pytest.fixture
def rows():
    """September and October 2026, hand-checkable.

    October: income 40000; Food 8000 + Shopping 4000 + Transportation 1000
             = 13000 expenses, savings 27000 (67.5%)
    """
    return [
        txn("2026-09-01", 40000, "Salary", "income"),
        txn("2026-09-05", 5000, "Food"),
        txn("2026-09-12", 3000, "Shopping"),
        txn("2026-09-20", 2000, "Transportation"),
        txn("2026-10-01", 40000, "Salary", "income"),
        txn("2026-10-06", 8000, "Food"),
        txn("2026-10-14", 4000, "Shopping"),
        txn("2026-10-22", 1000, "Transportation"),
    ]


@pytest.fixture
def context(rows):
    return chat.build_context(rows, current="2026-10")


# --------------------------------------------------------------------------
# Context
# --------------------------------------------------------------------------

def test_context_matches_the_dashboard_arithmetic(context):
    assert context["has_data"] is True
    assert context["this_month"]["income"] == 40000.0
    assert context["this_month"]["expenses"] == 13000.0
    assert context["this_month"]["savings"] == 27000.0
    assert context["this_month"]["savings_rate_pct"] == 67.5
    assert context["last_month"]["expenses"] == 10000.0


def test_context_is_compact_enough_for_a_prompt(context):
    """A few hundred tokens of aggregates, not a transaction dump."""
    import json
    assert len(json.dumps(context)) < 4000
    assert "description" not in json.dumps(context), (
        "raw transaction descriptions must not be shipped to a third party"
    )


def test_context_with_no_data_is_still_usable():
    assert chat.build_context([])["has_data"] is False


# --------------------------------------------------------------------------
# Rule engine -- answers must contain the user's REAL figures
# --------------------------------------------------------------------------

def test_how_much_did_i_spend(context):
    answer = chat.answer_from_rules("How much did I spend this month?", context)
    assert "13,000" in answer.text
    assert answer.source == "rules"


def test_where_am_i_spending_the_most(context):
    answer = chat.answer_from_rules("Where am I spending the most money?", context)
    assert "Food" in answer.text
    assert "8,000" in answer.text
    assert "61.5" in answer.text          # 8000/13000


def test_why_are_my_expenses_increasing(context):
    answer = chat.answer_from_rules("Why are my expenses increasing?", context)
    assert "Food" in answer.text
    assert "3,000" in answer.text          # 8000 - 5000
    assert "Sep 2026" in answer.text


def test_how_can_i_save_5000(context):
    answer = chat.answer_from_rules("How can I save ₹5,000 every month?", context)
    assert "5,000" in answer.text
    # discretionary = Food 8000 + Shopping 4000 = 12000
    assert "12,000" in answer.text
    assert "not predictions" in answer.text


def test_create_a_budget(context):
    answer = chat.answer_from_rules("Create a budget based on my income.", context)
    assert "20,000" in answer.text         # 50% of 40000
    assert "12,000" in answer.text         # 30%
    assert "8,000" in answer.text          # 20%


def test_savings_question(context):
    answer = chat.answer_from_rules("What is my savings rate?", context)
    assert "27,000" in answer.text
    assert "67.5" in answer.text


def test_emergency_fund_without_a_recorded_figure(rows):
    context = chat.build_context(rows, current="2026-10")
    answer = chat.answer_from_rules("Do I have enough emergency fund?", context)
    assert "not recorded" in answer.text.lower()
    # average monthly expense = (10000 + 13000)/2 = 11500; six months = 69000
    assert "69,000" in answer.text


def test_emergency_fund_with_a_recorded_figure(rows):
    context = chat.build_context(rows, current="2026-10", emergency_fund=69000)
    answer = chat.answer_from_rules("Is my emergency fund enough?", context)
    assert "6.0 months" in answer.text


def test_budget_status_reports_overruns(rows):
    budgets = [{"id": 1, "category": "Food", "amount": 6000, "month": 10, "year": 2026}]
    context = chat.build_context(rows, budgets=budgets, current="2026-10")
    answer = chat.answer_from_rules("How are my budgets doing?", context)
    assert "over" in answer.text.lower()
    assert "Food" in answer.text


def test_goals_question(rows):
    goals = [{"name": "Laptop", "target_amount": 60000.0, "saved_amount": 15000.0,
              "progress_pct": 25.0}]
    context = chat.build_context(rows, goals=goals, current="2026-10")
    answer = chat.answer_from_rules("How are my savings goals?", context)
    assert "Laptop" in answer.text and "25" in answer.text


# --------------------------------------------------------------------------
# Honesty constraints
# --------------------------------------------------------------------------

def test_never_claims_data_it_does_not_have():
    context = chat.build_context([])
    answer = chat.answer_from_rules("How much did I spend this month?", context)
    assert "not recorded any transactions" in answer.text
    assert answer.used_context is False


def test_investment_question_refuses_to_recommend(context):
    answer = chat.answer_from_rules("Which mutual fund should I invest in?", context)
    assert "cannot recommend" in answer.text.lower()
    assert "predict returns" in answer.text.lower()


def test_every_answer_carries_the_disclaimer(context):
    for question in ["How much did I spend?", "Create a budget", "hello", "asdfgh"]:
        payload = chat.answer_from_rules(question, context).to_dict()
        assert "not financial advice" in payload["disclaimer"]


def test_unknown_question_says_so_rather_than_guessing(context):
    answer = chat.answer_from_rules("What is the capital of France?", context)
    assert "not sure how to answer" in answer.text.lower()
    assert answer.suggestions


def test_partial_month_answers_are_qualified(rows):
    """Mid-month, income has landed but bills have not. Say so."""
    from datetime import date
    today = date.today()
    current = f"{today:%Y-%m}"
    rows = rows + [txn(f"{current}-01", 40000, "Salary", "income"),
                   txn(f"{current}-01", 500, "Food")]
    context = chat.build_context(rows, current=current)
    answer = chat.answer_from_rules("What is my savings rate?", context)
    assert "month is not over" in answer.text


def test_amount_extraction():
    assert chat._extract_amount("How can I save ₹5,000 every month?") == 5000.0
    assert chat._extract_amount("save 5k a month") == 5000.0
    assert chat._extract_amount("save 2 lakh") == 200000.0
    assert chat._extract_amount("how do I save money") is None
    # A bare small number is a count, not a rupee target.
    assert chat._extract_amount("my top 3 categories") is None


# --------------------------------------------------------------------------
# Gemini path and its fallback -- the important failure behaviour
# --------------------------------------------------------------------------

def test_no_api_key_uses_the_rule_engine(context):
    answer = chat.ask("How much did I spend this month?", context, api_key="")
    assert answer.source == "rules"
    assert "13,000" in answer.text
    assert answer.error is None, "no key is normal operation, not an error"


def test_gemini_failure_falls_back_with_the_correct_figure(monkeypatch, context):
    """The whole point of the fallback: a dead API must not break the feature."""
    def boom(*args, **kwargs):
        raise RuntimeError("quota exceeded")

    monkeypatch.setattr(chat, "answer_from_gemini", boom)

    answer = chat.ask("How much did I spend this month?", context,
                      api_key="fake-key", model="gemini-2.5-flash")
    assert answer.source == "rules"
    assert "13,000" in answer.text, "the fallback must still be correct"
    assert answer.error is not None
    assert "built-in engine" in answer.error


@pytest.mark.parametrize("failure", [
    RuntimeError("Gemini returned an empty response"),
    TimeoutError("deadline exceeded"),
    ConnectionError("network unreachable"),
    ValueError("malformed response"),
])
def test_every_kind_of_gemini_failure_degrades(monkeypatch, context, failure):
    monkeypatch.setattr(chat, "answer_from_gemini",
                        lambda *a, **k: (_ for _ in ()).throw(failure))
    answer = chat.ask("Where am I spending the most?", context, api_key="k", model="m")
    assert answer.source == "rules"
    assert "Food" in answer.text


def test_gemini_success_is_used_when_it_works(monkeypatch, context):
    monkeypatch.setattr(chat, "answer_from_gemini",
                        lambda *a, **k: chat.Answer("A model answer.", source="gemini"))
    answer = chat.ask("How much did I spend?", context, api_key="k", model="m")
    assert answer.source == "gemini"
    assert answer.text == "A model answer."


def test_system_prompt_forbids_invention():
    assert "Never invent" in chat.SYSTEM_PROMPT
    assert "not a financial adviser" in chat.SYSTEM_PROMPT
    assert "guarantee or predict investment returns" in chat.SYSTEM_PROMPT


# --------------------------------------------------------------------------
# API
# --------------------------------------------------------------------------

def register(client):
    return client.post("/api/register", json={
        "name": "Chat Tester", "email": "chat@example.com", "password": "testpass123"})


def test_chat_requires_login(client):
    assert client.post("/api/ai/chat", json={"message": "hi"}).status_code == 401


def test_chat_endpoint_answers_from_real_data(client):
    register(client)
    client.post("/api/transactions", json={
        "description": "Monthly salary", "amount": 40000, "category": "Salary",
        "txn_type": "income", "date": "2026-10-01"})
    client.post("/api/transactions", json={
        "description": "Swiggy order", "amount": 8000, "category": "Food",
        "txn_type": "expense", "date": "2026-10-06"})

    response = client.post("/api/ai/chat", json={"message": "How much did I spend?"})
    assert response.status_code == 200
    body = response.get_json()
    assert "8,000" in body["answer"]
    assert body["source"] in ("rules", "gemini")
    assert "not financial advice" in body["disclaimer"]


def test_chat_rejects_an_empty_message(client):
    register(client)
    response = client.post("/api/ai/chat", json={"message": "   "})
    assert response.status_code == 400
    assert response.get_json()["field"] == "message"


def test_starters_never_leak_the_key(client, app):
    register(client)
    app.config["GEMINI_API_KEY"] = "super-secret-key-value"
    body = client.get("/api/ai/chat/starters").get_json()
    assert body["llm_configured"] is True
    assert "super-secret-key-value" not in str(body)
    assert body["suggestions"]


def test_chat_response_never_leaks_the_key(client, app):
    register(client)
    app.config["GEMINI_API_KEY"] = "super-secret-key-value"
    # No real network call: force the fallback.
    body = client.post("/api/ai/chat", json={"message": "hello"}).get_json()
    assert "super-secret-key-value" not in str(body)


# --------------------------------------------------------------------------
# Intent routing
#
# Pinned as a table because ORDER is what broke: generic keywords that also
# appear inside a more specific topic ("fund" in "mutual fund", "savings" in
# "savings goals") stole questions from the rule that should have answered.
# --------------------------------------------------------------------------

@pytest.mark.parametrize("question,expected", [
    # the five the UI suggests
    ("How much did I spend this month?", "spend_total"),
    ("Where am I spending the most money?", "top_category"),
    ("How can I save ₹5,000 every month?", "how_to_save"),
    ("Why are my expenses increasing?", "why_increasing"),
    ("Create a budget based on my income.", "make_budget"),
    # the ones that previously mis-routed
    ("Which mutual fund should I invest in?", "investing"),
    ("How are my savings goals?", "goals"),
    ("What is the capital of France?", "unknown"),
    ("Tell me a joke", "unknown"),
    # close variants
    ("what did I spend on food", "spend_total"),
    ("biggest expense category", "top_category"),
    ("how do I reduce my spending", "how_to_save"),
    ("am I over budget", "budget_status"),
    ("do I have enough emergency savings", "emergency_fund"),
    ("what is my financial health score", "health"),
    ("hello", "capabilities"),
    ("what can you do", "capabilities"),
    # "where did my money go" -- the most natural phrasing of a question the UI
    # itself suggests as "Where am I spending the most money?". It contains no
    # form of "spend", so it fell through to "I am not sure how to answer that".
    ("Where did most of my money go last month?", "top_category"),
    ("where does my money go", "top_category"),
    ("where is all my cash going", "top_category"),
    # ...without swallowing the saving question that also says "where" + "money"
    ("where can I save money", "how_to_save"),
    ("where should I invest my money", "investing"),
])
def test_intent_routing(question, expected):
    assert chat._intent(question) == expected, (
        f"{question!r} routed to {chat._intent(question)!r}, expected {expected!r}"
    )


# --------------------------------------------------------------------------
# Coherence: a single answer must not mix windows
# --------------------------------------------------------------------------

def _mid_month_rows(base_rows):
    from datetime import date
    today = date.today()
    current = f"{today:%Y-%m}"
    return base_rows + [
        txn(f"{current}-01", 40000, "Salary", "income"),
        txn(f"{current}-01", 600, "Food"),
    ], current


def test_increase_answer_does_not_mix_windows(rows):
    """Regression: the categories were compared over the elapsed window while
    the total used full months, producing 'Transportation is up ... total
    spending moved from 41,772 to 2,028' -- two true numbers, one incoherent
    sentence."""
    rows, current = _mid_month_rows(rows)
    context = chat.build_context(rows, current=current)
    answer = chat.answer_from_rules("Why are my expenses increasing?", context)

    like = context["like_for_like"]
    if like:
        # Whatever totals are quoted must be the like-for-like pair.
        assert chat._rupees(like["current"]) in answer.text
        assert chat._rupees(like["previous"]) in answer.text


def test_top_category_does_not_repeat_the_leader(context):
    answer = chat.answer_from_rules("Where am I spending the most?", context)
    assert answer.text.count("Food") == 1, f"leader named twice: {answer.text}"


def test_saving_advice_uses_a_complete_month_mid_month(rows):
    """Four days of groceries is not a food budget."""
    rows, current = _mid_month_rows(rows)
    context = chat.build_context(rows, current=current)
    assert context["baseline_month"]["is_current"] is False

    answer = chat.answer_from_rules("How can I save 5000 every month?", context)
    assert "last complete month" in answer.text
    # October's discretionary total (Food 8000 + Shopping 4000), not the 600
    # recorded so far this month.
    assert "12,000" in answer.text


def test_impossible_saving_target_is_said_plainly(rows):
    answer = chat.answer_from_rules("How can I save 50000 every month?",
                                    chat.build_context(rows, current="2026-10"))
    assert "not achievable" in answer.text
    assert "rent" in answer.text or "income" in answer.text


def test_baseline_is_this_month_when_the_month_is_complete(rows):
    context = chat.build_context(rows, current="2026-10")
    assert context["baseline_month"]["is_current"] is True
