"""FINWISE AI Assistant.

Two answer paths, in this order:

1. **Gemini**, when GEMINI_API_KEY is configured. The model is given a compact
   JSON summary of the user's REAL aggregates and a system prompt that forbids
   inventing figures.
2. **A rule-based engine**, always. It runs when no key is set, when the API
   fails, and when the model is slow. It answers from the same aggregates.

The fallback is not a degraded stub -- it is the correctness floor. Both paths
read the same `build_context()` output, which is produced by the same
`ai/analytics.py` functions that fill the dashboard, so the assistant can never
contradict the charts.

Why the LLM is not trusted with arithmetic
------------------------------------------
Every figure the assistant can quote is computed in Python and handed to the
model pre-formatted. The model is used for phrasing and for understanding a
loosely worded question, never for calculation. A language model asked to sum a
column will usually be right, and "usually" is not a property you want in a
finance app.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

from ai import analytics

DISCLAIMER = (
    "FINWISE AI is an educational project. This is general information based on "
    "the transactions you have recorded, not financial advice."
)

SYSTEM_PROMPT = """You are FINWISE AI Assistant, a personal finance helper inside \
an app the user is already signed into.

You are given a JSON summary of THIS user's real, recorded financial data.

Rules you must follow:
1. Use ONLY the figures in the JSON. Never invent a transaction, a merchant, a \
date or an amount. If the JSON does not contain what is needed to answer, say \
plainly that the data is not recorded yet and say what the user would need to add.
2. Do not perform arithmetic the JSON has not already done. The figures given \
are authoritative and already rounded; quote them rather than recomputing.
3. Amounts are Indian rupees. Always format currency figures with standard comma grouping and the ₹ symbol (e.g. ₹8,000 or ₹15,500).
4. Never guarantee or predict investment returns. Never promise an outcome. \
Describe what the user's own numbers show.
5. Be concise and concrete: 2-5 short sentences, or a short list. Reference \
the user's actual categories and amounts.
6. You are not a financial adviser and must not present yourself as one.

If the user asks something unrelated to their finances or to personal finance \
generally, say that is outside what you can help with here."""


# --------------------------------------------------------------------------
# Context
# --------------------------------------------------------------------------

def build_context(rows: list[dict], *, budgets=None, goals=None,
                  monthly_income=None, emergency_fund=None,
                  current: str | None = None) -> dict:
    """A compact, factual summary of the user's finances.

    Deliberately small: a few hundred tokens of aggregates rather than a dump
    of every transaction. That keeps the prompt cheap, avoids sending the full
    transaction history to a third party, and removes the temptation for the
    model to do its own arithmetic over raw rows.
    """
    budgets = budgets or []
    series = analytics.monthly_series(rows)
    if not series:
        return {"has_data": False, "disclaimer": DISCLAIMER}

    current = current or series[-1]["month"]
    this_month = next((m for m in series if m["month"] == current), series[-1])
    index = series.index(this_month)
    previous = series[index - 1] if index > 0 else None

    day = analytics.elapsed_day(current)
    month_rows = analytics.filter_month(rows, current, day)
    breakdown = analytics.category_breakdown(month_rows)

    comparison = (
        analytics.month_over_month(rows, current, previous["month"])[:5]
        if previous else []
    )

    # Like-for-like totals: the per-category comparison above is truncated to
    # the elapsed day, so the headline totals must be too. Mixing a truncated
    # category list with full-month totals produces "Transportation is up,
    # total spending moved from 41,772 to 2,028" -- two true numbers forming
    # one incoherent sentence.
    def spend_in(month_key, upto):
        return round(sum(float(r["amount"])
                         for r in analytics.filter_month(rows, month_key, upto)
                         if r.get("txn_type") == "expense"), 2)

    # When the month is in progress it is a useless baseline for advice -- four
    # days of groceries is not a food budget. The last complete month is.
    baseline = previous if (day is not None and previous) else this_month
    baseline_rows = analytics.filter_month(rows, baseline["month"])

    return {
        "has_data": True,
        "month": current,
        "month_label": analytics.month_label(current),
        "month_in_progress": day is not None,
        "days_elapsed": day,
        "this_month": {
            "income": this_month["income"],
            "expenses": this_month["expense"],
            "savings": this_month["savings"],
            "savings_rate_pct": this_month["savings_rate"],
            "transactions": this_month["transactions"],
        },
        "last_month": ({
            "label": previous["label"],
            "income": previous["income"],
            "expenses": previous["expense"],
            "savings": previous["savings"],
        } if previous else None),
        "spending_by_category": [
            {"category": b["category"], "amount": b["amount"],
             "share_pct": b["share"], "transactions": b["transactions"]}
            for b in breakdown
        ],
        "category_changes_vs_last_month": [
            {"category": c["category"], "change": c["change"],
             "change_pct": c["change_pct"]}
            for c in comparison
        ],
        # Totals over the SAME elapsed window as the category changes above.
        "like_for_like": ({
            "current": spend_in(current, day),
            "previous": spend_in(previous["month"], day),
            "previous_label": previous["label"],
        } if previous else None),
        # A complete month to base advice on. Equal to this month when this
        # month is complete.
        "baseline_month": {
            "label": baseline["label"],
            "is_current": baseline["month"] == current,
            "expenses": baseline["expense"],
            "spending_by_category": [
                {"category": b["category"], "amount": b["amount"],
                 "share_pct": b["share"], "transactions": b["transactions"]}
                for b in analytics.category_breakdown(baseline_rows)
            ],
        },
        "budgets": analytics.budget_alerts(rows, budgets, current),
        "goals": goals or [],
        "self_reported": {
            "monthly_income": float(monthly_income) if monthly_income is not None else None,
            "emergency_fund": float(emergency_fund) if emergency_fund is not None else None,
        },
        "months_recorded": len(series),
        "average_monthly_expense": round(
            sum(m["expense"] for m in series) / len(series), 2),
        "disclaimer": DISCLAIMER,
    }


# --------------------------------------------------------------------------
# Rule-based engine
# --------------------------------------------------------------------------

@dataclass
class Answer:
    text: str
    source: str                      # "gemini" | "rules"
    used_context: bool = True
    suggestions: list[str] = field(default_factory=list)
    error: str | None = None         # why Gemini was not used, when relevant

    def to_dict(self) -> dict:
        return {
            "answer": self.text,
            "source": self.source,
            "used_your_data": self.used_context,
            "suggestions": self.suggestions,
            "notice": self.error,
            "disclaimer": DISCLAIMER,
        }


SUGGESTED_QUESTIONS = [
    "How much did I spend this month?",
    "Where am I spending the most money?",
    "How can I save ₹5,000 every month?",
    "Why are my expenses increasing?",
    "Create a budget based on my income.",
]


def _rupees(value) -> str:
    return analytics._rupees(value)


def _intent(question: str) -> str:
    """Match a question to an intent.

    A deliberately small keyword matcher. It is not pretending to be NLU: it
    covers the questions the UI suggests plus close variants, and falls through
    to "unknown" rather than guessing.

    ORDER MATTERS, and the specific cases must come first. Earlier drafts put
    the loose rules first and mis-routed real questions: "which mutual fund
    should I invest in" matched the emergency-FUND rule, and "how are my
    savings goals" matched the how-to-SAVE rule. A generic keyword that also
    appears inside a more specific topic has to be tested after it.
    """
    q = question.lower().strip()

    def has(*words):
        return any(re.search(rf"\b{w}\b", q) for w in words)

    # --- most specific topics first -----------------------------------
    if has("goal", "goals"):
        return "goals"
    if has("invest", "investing", "investment", "investments", "sip",
           "mutual", "stock", "stocks", "shares", "equity"):
        return "investing"
    if has("emergency"):                       # NOT a bare "fund"
        return "emergency_fund"
    if has("health") and has("score", "financial", "check", "checkup"):
        return "health"

    # --- budgets --------------------------------------------------------
    if has("budget", "budgets"):
        if has("create", "make", "plan", "suggest", "build", "set", "recommend"):
            return "make_budget"
        return "budget_status"

    # --- spending -------------------------------------------------------
    spend_words = ("spend", "spent", "spending", "expense", "expenses", "cost", "costs")
    if has(*spend_words) and has("most", "highest", "biggest", "largest", "where", "top"):
        return "top_category"
    if has("why", "increase", "increasing", "rising", "rose", "higher", "gone") and has(*spend_words):
        return "why_increasing"

    # --- saving ---------------------------------------------------------
    # "How do I reduce my spending" is a how-to-save question containing no
    # form of the word "save", so reduction verbs count on their own.
    cut_words = ("cut", "reduce", "lower", "spend less", "trim")
    # "where" counts as a how-question here: "where can I save money" is asking
    # for advice, not for a breakdown, and the where+money rule below would
    # otherwise claim it.
    if has("save", "saving", "savings") and has("how", "where", "more", "increase",
                                                "improve", *cut_words):
        return "how_to_save"
    if has(*cut_words) and has(*spend_words, "money", "bills"):
        return "how_to_save"
    if has("saving", "savings", "saved"):
        return "savings_status"

    # "Where did my money go?" is the most natural way to ask which category
    # took the most, and it contains no form of the word "spend" -- so the
    # top_category rule above, which requires one, let it fall through to
    # "I am not sure how to answer that" while the UI was suggesting the same
    # question in different words.
    #
    # It sits HERE, after the saving rules, on purpose: placed with the other
    # spending rules it would also swallow "where can I save money", which is
    # a how-to-save question.
    if has("where") and has("money", "cash"):
        return "top_category"

    if has(*spend_words) or (has("much") and has("money")):
        return "spend_total"

    # --- greetings and capability questions, matched tightly ------------
    if has("hello", "hi", "hey", "thanks", "thank"):
        return "capabilities"
    if has("help", "do") and has("you", "can", "what"):
        return "capabilities"

    return "unknown"


def answer_from_rules(question: str, context: dict) -> Answer:
    """Answer using only the figures in `context`."""
    if not context.get("has_data"):
        return Answer(
            "You have not recorded any transactions yet, so I cannot tell you "
            "anything about your spending. Add your income and a few expenses "
            "on the Transactions page and ask me again.",
            source="rules", used_context=False, suggestions=SUGGESTED_QUESTIONS,
        )

    intent = _intent(question)
    this = context["this_month"]
    label = context["month_label"]
    partial = context.get("month_in_progress")
    window = (f" so far ({context['days_elapsed']} days into the month)"
              if partial else "")
    categories = context["spending_by_category"]

    def top_categories(n=3, skip=0):
        """`skip` avoids naming the leader twice in 'X is biggest. After that: X, Y'."""
        return ", ".join(
            f"{c['category']} {_rupees(c['amount'])} ({c['share_pct']}%)"
            for c in categories[skip:skip + n]
        )

    if intent == "spend_total":
        if not categories:
            return Answer(f"You have not recorded any expenses in {label}{window}.",
                          source="rules")
        text = (
            f"You spent {_rupees(this['expenses'])} in {label}{window}, across "
            f"{this['transactions']} transactions. The largest categories were "
            f"{top_categories()}."
        )
        if context["last_month"]:
            text += (f" Last month you spent "
                     f"{_rupees(context['last_month']['expenses'])} in total.")
        return Answer(text, source="rules")

    if intent == "top_category":
        if not categories:
            return Answer(f"No expenses recorded in {label}{window} yet.", source="rules")
        top = categories[0]
        text = (
            f"Your biggest category in {label}{window} is {top['category']} at "
            f"{_rupees(top['amount'])}, which is {top['share_pct']}% of your "
            f"spending across {top['transactions']} transactions."
        )
        rest = top_categories(2, skip=1)
        if rest:
            text += f" After that: {rest}."
        return Answer(text, source="rules")

    if intent == "why_increasing":
        changes = context["category_changes_vs_last_month"]
        risers = [c for c in changes if c["change"] > 0]
        if not context["last_month"]:
            return Answer(
                "I only have one month of data, so I cannot compare yet. "
                "Record another month and I can show you what changed.",
                source="rules")
        if not risers:
            like = context.get("like_for_like")
            prev_spend = like["previous"] if like else context["last_month"]["expenses"]
            curr_spend = like["current"] if like else this["expenses"]
            return Answer(
                f"Nothing rose compared with {context['last_month']['label']} — "
                f"your spending went from "
                f"{_rupees(prev_spend)} to "
                f"{_rupees(curr_spend)}.",
                source="rules")
        lines = "; ".join(
            f"{c['category']} up {_rupees(c['change'])}"
            + (f" ({c['change_pct']}%)" if c["change_pct"] is not None else "")
            for c in risers[:3]
        )
        # The category figures above are over the elapsed window, so the total
        # must be the matching one -- not the full-month total.
        like = context.get("like_for_like")
        if like:
            comparing = (f"over the same {context['days_elapsed']} days of "
                         f"{like['previous_label']}" if partial
                         else f"with {like['previous_label']}")
            totals = (f" Total spending {comparing}: "
                      f"{_rupees(like['previous'])} then, "
                      f"{_rupees(like['current'])} now.")
        else:
            totals = ""
        return Answer(
            f"Compared with {context['last_month']['label']}, the increases were: "
            f"{lines}.{totals}",
            source="rules")

    if intent == "how_to_save":
        wanted = _extract_amount(question)
        # Advice needs a FULL month to work from. Four days of groceries is not
        # a food budget, and "cut 100% of your ₹574" is not advice.
        baseline = context["baseline_month"]
        basis_categories = baseline["spending_by_category"]
        discretionary = [c for c in basis_categories
                         if c["category"] in {"Food", "Shopping", "Entertainment"}]
        if not discretionary:
            return Answer(
                f"You saved {_rupees(this['savings'])} in {label}{window}. I do not "
                f"see enough discretionary spending recorded to suggest specific cuts.",
                source="rules")

        total_discretionary = sum(c["amount"] for c in discretionary)
        basis = ("" if baseline["is_current"]
                 else f" (based on {baseline['label']}, your last complete month)")
        lines = []
        if wanted and total_discretionary > 0:
            needed_pct = round(wanted / total_discretionary * 100)
            if needed_pct > 100:
                lines.append(
                    f"Freeing {_rupees(wanted)} a month from discretionary spending "
                    f"alone is not achievable: Food, Shopping and Entertainment "
                    f"together come to {_rupees(total_discretionary)}{basis}. You "
                    f"would need to reduce a fixed cost such as rent, or increase income."
                )
            else:
                lines.append(
                    f"To free {_rupees(wanted)} a month you would need to cut about "
                    f"{needed_pct}% from your discretionary categories, which total "
                    f"{_rupees(total_discretionary)}{basis}."
                )
        for c in discretionary[:3]:
            lines.append(
                f"{c['category']}: {_rupees(c['amount'])} — a 20% cut frees "
                f"{_rupees(c['amount'] * 0.2)}."
            )
        lines.append("These are arithmetic on your own spending, not predictions.")
        return Answer(" ".join(lines), source="rules")

    if intent == "make_budget":
        income = this["income"] or context["self_reported"]["monthly_income"]
        if not income:
            return Answer(
                "I do not have an income figure for you. Add an income "
                "transaction, or set your monthly income in Settings, and I can "
                "suggest a split.",
                source="rules")
        needs, wants, save = income * 0.5, income * 0.3, income * 0.2
        return Answer(
            f"On an income of {_rupees(income)}, a common starting split is "
            f"50/30/20: {_rupees(needs)} for needs (rent, utilities, groceries, "
            f"transport), {_rupees(wants)} for wants (eating out, shopping, "
            f"entertainment) and {_rupees(save)} saved. "
            f"For reference you actually spent {_rupees(this['expenses'])} in "
            f"{label}{window}. You can set these as budgets in Budget Planner.",
            source="rules")

    if intent == "budget_status":
        budgets = context["budgets"]
        if not budgets:
            return Answer(
                "You have not set any budgets for this month. Budget Planner "
                "lets you set an overall limit and per-category limits.",
                source="rules")
        over = [b for b in budgets if b["status"] == "over"]
        text = "; ".join(
            f"{b['label']}: {_rupees(b['spent'])} of {_rupees(b['budget'])} "
            f"({b['used_pct']}%)" for b in budgets[:4]
        )
        suffix = (f" You are over on {', '.join(b['label'] for b in over)}."
                  if over else " Nothing is over budget.")
        return Answer(f"Budget status for {label}: {text}.{suffix}", source="rules")

    if intent == "savings_status":
        rate = this["savings_rate_pct"]
        rate_text = f" ({rate}% of income)" if rate is not None else ""
        text = (f"You saved {_rupees(this['savings'])} in {label}{window}"
                f"{rate_text}, from income of {_rupees(this['income'])} and "
                f"expenses of {_rupees(this['expenses'])}.")
        if partial:
            text += (" Bear in mind the month is not over, so bills still to "
                     "come are not reflected yet.")
        return Answer(text, source="rules")

    if intent == "emergency_fund":
        fund = context["self_reported"]["emergency_fund"]
        average = context["average_monthly_expense"]
        if fund is None:
            return Answer(
                f"You have not recorded an emergency fund. Your average monthly "
                f"spending is {_rupees(average)}, so a six-month cushion would be "
                f"about {_rupees(average * 6)}. You can record your fund in Settings.",
                source="rules")
        months = fund / average if average else 0
        return Answer(
            f"Your recorded emergency fund of {_rupees(fund)} covers about "
            f"{months:.1f} months of your average {_rupees(average)} monthly "
            f"spending. Six months is a commonly used target, which would be "
            f"about {_rupees(average * 6)}.",
            source="rules")

    if intent == "goals":
        goals = context["goals"]
        if not goals:
            return Answer("You have not created any savings goals yet. "
                          "Savings Goals lets you add one with a target and a date.",
                          source="rules")
        lines = "; ".join(
            f"{g['name']}: {_rupees(g['saved_amount'])} of "
            f"{_rupees(g['target_amount'])} ({g['progress_pct']}%)"
            for g in goals[:4]
        )
        return Answer(f"Your goals: {lines}.", source="rules")

    if intent == "health":
        return Answer(
            "Open Financial Health and press Analyse my financial health. It "
            "scores six components out of 100 and shows every weight and the "
            "figures behind each one.",
            source="rules", used_context=False)

    if intent == "investing":
        return Answer(
            "I can tell you what your own records show — for example that you "
            f"have {_rupees(next((c['amount'] for c in categories if c['category'] == 'Investments'), 0))} "
            f"recorded under Investments in {label}{window}. I cannot recommend "
            "specific investments or predict returns, and nothing here is "
            "financial advice.",
            source="rules")

    if intent == "capabilities":
        return Answer(
            "I can answer questions about the finances you have recorded here: "
            "what you spent, where it went, how it compares with last month, how "
            "your budgets are doing, and what cutting a category would free up. "
            "Everything I say comes from your own transactions.",
            source="rules", used_context=False, suggestions=SUGGESTED_QUESTIONS)

    return Answer(
        "I am not sure how to answer that from your recorded data. I can help "
        "with what you spent, where it went, month-to-month changes, budgets, "
        "savings and goals.",
        source="rules", used_context=False, suggestions=SUGGESTED_QUESTIONS)


def _extract_amount(question: str) -> float | None:
    """Pull a rupee figure out of a question, e.g. '₹5,000' or '5000' or '5k'."""
    text = question.lower().replace(",", "")
    match = re.search(r"(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(k|thousand|lakh|l)?\b", text)
    if not match:
        return None
    value = float(match.group(1))
    unit = match.group(2)
    if unit in ("k", "thousand"):
        value *= 1_000
    elif unit in ("lakh", "l"):
        value *= 100_000
    # A bare small number is more likely a count than a rupee target.
    return value if value >= 100 else None


# --------------------------------------------------------------------------
# Gemini
# --------------------------------------------------------------------------

def answer_from_gemini(question: str, context: dict, *, api_key: str,
                       model: str, timeout: float = 20.0) -> Answer:
    """Ask Gemini, with the user's aggregates as grounding. Raises on failure."""
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    prompt = (
        f"Here is the user's financial data as JSON:\n\n"
        f"{json.dumps(context, ensure_ascii=False, indent=None)}\n\n"
        f"User's question: {question}"
    )

    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.3,          # phrasing varies; facts must not
            max_output_tokens=500,
            http_options=types.HttpOptions(timeout=int(timeout * 1000)),
        ),
    )

    text = (response.text or "").strip()
    if not text:
        raise RuntimeError("Gemini returned an empty response")
    return Answer(text, source="gemini")


def ask(question: str, context: dict, *, api_key: str = "", model: str = "",
        logger=None) -> Answer:
    """Answer a question, preferring Gemini and always falling back to rules.

    Any Gemini failure is caught: a dead key, a quota error, a network timeout
    or a malformed response all degrade to the rule engine rather than showing
    the user an error. The response records which path produced it so the UI
    can be honest about it.
    """
    question = (question or "").strip()
    if not question:
        return Answer("Ask me something about your finances.", source="rules",
                      used_context=False, suggestions=SUGGESTED_QUESTIONS)

    if api_key:
        try:
            return answer_from_gemini(question, context, api_key=api_key, model=model)
        except Exception as exc:  # noqa: BLE001 - any failure must degrade, not raise
            if logger:
                logger.warning("Gemini unavailable, using rule engine: %s", exc)
            fallback = answer_from_rules(question, context)
            fallback.error = (
                "The AI model was unavailable, so this answer came from the "
                "built-in engine using your recorded data."
            )
            return fallback

    return answer_from_rules(question, context)
