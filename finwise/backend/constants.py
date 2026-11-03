"""Shared vocabulary.

Lives in its own module because both the ORM layer and the ML layer need it,
and ai/categorizer.py must never import models.py (that would drag a database
dependency into a pure function and make it untestable without an app context).
"""

# The label set the categorizer predicts over and the only values a transaction
# may carry. Order is the display order in the UI.
CATEGORIES = [
    "Food",
    "Shopping",
    "Transportation",
    "Education",
    "Entertainment",
    "Healthcare",
    "Housing",
    "Utilities",
    "Investments",
    "Salary",
    "Other",
]

# Categories that are normally income rather than spending. Used to sanity-check
# a prediction against the transaction type the user chose.
INCOME_CATEGORIES = {"Salary", "Investments"}

TXN_TYPES = ["income", "expense"]

PAYMENT_METHODS = ["UPI", "Debit Card", "Credit Card", "Cash", "Net Banking", "Auto Debit"]

# Below this probability the categorizer declines to guess and returns "Other".
# Chosen so a genuinely unknown description does not get a confident wrong label.
CONFIDENCE_FLOOR = 0.28
