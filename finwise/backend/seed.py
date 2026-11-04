"""Seed a demo account with realistic Indian personal-finance data.

Run:  python seed.py            (adds the demo user, keeps anything else)
      python seed.py --reset    (deletes the demo user's data first)

Everything created here is marked `is_demo=True` on the user, and the UI
labels the account as sample data. Real accounts are never touched.

The data is generated rather than hardcoded so it always spans the eight
months ending with the current one -- a fixed dataset would drift out of date
and make the dashboard look empty.
"""
from __future__ import annotations

import argparse
import random
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select

from app import create_app
from models import Budget, SavingsGoal, Transaction, User, UserPreference, db

DEMO_EMAIL = "demo@finwise.ai"
DEMO_PASSWORD = "demo1234"
MONTHS = 8

# Deterministic so the demo looks the same at every evaluation.
RNG = random.Random(20261104)

MONTHLY_INCOME = Decimal("52000")

# (description pool, category, typical amount range, times per month)
RECURRING = [
    (["House rent paid to landlord"], "Housing", (16000, 16000), 1),
    (["Society maintenance charges"], "Housing", (1800, 1800), 1),
    (["Electricity bill payment", "BESCOM electricity bill"], "Utilities", (900, 2400), 1),
    (["Jio fiber broadband bill"], "Utilities", (799, 799), 1),
    (["Airtel mobile recharge", "Jio prepaid recharge"], "Utilities", (239, 399), 1),
    (["LPG gas cylinder booking"], "Utilities", (905, 905), 1),
    (["Netflix subscription"], "Entertainment", (199, 499), 1),
    (["Spotify premium"], "Entertainment", (119, 119), 1),
    (["SIP in mutual fund", "Monthly SIP - index fund"], "Investments", (5000, 5000), 1),
    (["Cult fit gym membership"], "Healthcare", (1400, 1400), 1),
]

# Ranges tuned so a normal month lands around 42k against 52k income -- the
# demo should show a modestly healthy saver with one bad month, not someone
# permanently in deficit (which would peg the health score near zero and make
# every screen look broken).
VARIABLE = [
    (["Swiggy food order", "Zomato dinner", "Swiggy Instamart groceries",
      "Lunch at the canteen", "Dominos pizza", "Starbucks coffee",
      "BigBasket weekly groceries", "Blinkit late night snacks",
      "Dinner with friends", "Chai and snacks"], "Food", (120, 700), (10, 14)),
    (["Uber ride to college", "Ola cab to station", "Rapido bike ride",
      "Metro card recharge", "Auto fare", "Petrol fill at HP pump",
      "FASTag recharge"], "Transportation", (40, 800), (4, 8)),
    (["Amazon order", "Flipkart purchase", "Myntra clothing",
      "Nykaa skincare", "Decathlon sports gear", "Bought headphones",
      "New running shoes"], "Shopping", (450, 2500), (1, 3)),
    (["Movie tickets on BookMyShow", "PVR cinema", "Bought a game on Steam",
      "Weekend outing", "Bowling with friends"], "Entertainment", (250, 1200), (1, 3)),
    (["Apollo pharmacy medicines", "Doctor consultation", "Lab blood test",
      "Dental checkup"], "Healthcare", (200, 1200), (0, 2)),
    (["Udemy course", "Textbooks for the semester", "Stationery and notebooks",
      "Coursera subscription", "Printout and xerox charges"], "Education", (150, 1500), (0, 2)),
    (["ATM cash withdrawal", "Haircut at the salon", "Laundry and dry cleaning",
      "Sent money to a friend", "Courier charges"], "Other", (100, 1200), (1, 3)),
]

GOALS = [
    ("New laptop for college", 75000, 28000, 240),
    ("Emergency fund", 150000, 62000, 420),
    ("Goa trip with friends", 30000, 9500, 150),
]


def month_starts(count: int) -> list[date]:
    """First day of each of the last `count` months, oldest first."""
    today = date.today()
    cursor = date(today.year, today.month, 1)
    starts = []
    for _ in range(count):
        starts.append(cursor)
        cursor = date(cursor.year - 1, 12, 1) if cursor.month == 1 else date(cursor.year, cursor.month - 1, 1)
    return list(reversed(starts))


def days_in(start: date) -> int:
    nxt = date(start.year + 1, 1, 1) if start.month == 12 else date(start.year, start.month + 1, 1)
    return (nxt - start).days


def money(low: int, high: int) -> Decimal:
    value = RNG.randint(low, high) if high > low else low
    return Decimal(value).quantize(Decimal("0.01"))


def build_transactions(user_id: int) -> list[Transaction]:
    rows: list[Transaction] = []
    starts = month_starts(MONTHS)
    today = date.today()

    def add(day: date, description: str, amount: Decimal, category: str, txn_type: str):
        # Never generate a future-dated transaction in the current month.
        if day > today:
            return
        rows.append(Transaction(
            user_id=user_id, description=description, amount=amount,
            category=category, txn_type=txn_type, date=day,
            payment_method=RNG.choice(["UPI", "Debit Card", "Credit Card", "Cash", "Net Banking"]),
        ))

    for index, start in enumerate(starts):
        last_day = days_in(start)

        # --- income ---
        add(start, "Monthly salary credited", MONTHLY_INCOME, "Salary", "income")
        if index in (2, 5):
            add(start + timedelta(days=11), "Freelance project payment",
                money(6000, 14000), "Salary", "income")

        # --- recurring ---
        for pool, category, (low, high), times in RECURRING:
            for _ in range(times):
                day = start + timedelta(days=RNG.randint(1, min(26, last_day - 1)))
                add(day, RNG.choice(pool), money(low, high), category, "expense")

        for pool, category, (low, high), (min_n, max_n) in VARIABLE:
            count = RNG.randint(min_n, max_n)
            # A deliberate, visible shopping spike in the most recent full
            # month, so month-over-month comparison has something real to show.
            if category == "Shopping" and index == MONTHS - 2:
                count += 2
            for _ in range(count):
                day = start + timedelta(days=RNG.randint(0, last_day - 1))
                amount = money(low, high)
                if category == "Shopping" and index == MONTHS - 2:
                    amount = money(high // 2, high)
                add(day, RNG.choice(pool), amount, category, "expense")

    # --- two injected anomalies, for Phase 8's detector to find ---
    # Deliberately in different months, and both away from the shopping spike:
    # stacking them would produce a month so extreme that it reads as a bug
    # rather than as the unusual-but-real transaction it is meant to represent.
    add(starts[2] + timedelta(days=14), "Laptop purchase - Croma",
        Decimal("52000.00"), "Shopping", "expense")
    add(starts[4] + timedelta(days=9), "Emergency dental procedure",
        Decimal("24000.00"), "Healthcare", "expense")

    return rows


def seed(reset: bool = False) -> None:
    app = create_app()
    with app.app_context():
        user = db.session.scalar(select(User).where(User.email == DEMO_EMAIL))

        if user and reset:
            print(f"Removing existing demo data for {DEMO_EMAIL}")
            db.session.delete(user)   # cascades to every owned table
            db.session.commit()
            user = None

        if user:
            print(f"Demo user already exists ({DEMO_EMAIL}). Use --reset to rebuild.")
            return

        user = User(
            name="Demo User",
            email=DEMO_EMAIL,
            monthly_income=MONTHLY_INCOME,
            emergency_fund=Decimal("62000"),
            is_demo=True,
        )
        user.set_password(DEMO_PASSWORD)
        db.session.add(user)
        db.session.flush()            # need user.id for the children

        db.session.add(UserPreference(user_id=user.id))

        rows = build_transactions(user.id)
        db.session.add_all(rows)

        this_month = date.today()
        budgets = [
            (None, 38000), ("Food", 9000), ("Shopping", 6000),
            ("Transportation", 4000), ("Entertainment", 2500), ("Utilities", 4500),
        ]
        db.session.add_all([
            Budget(user_id=user.id, category=category, amount=Decimal(amount),
                   month=this_month.month, year=this_month.year)
            for category, amount in budgets
        ])

        db.session.add_all([
            SavingsGoal(user_id=user.id, name=name,
                        target_amount=Decimal(target), saved_amount=Decimal(saved),
                        target_date=date.today() + timedelta(days=days))
            for name, target, saved, days in GOALS
        ])

        db.session.commit()

        income = sum(float(r.amount) for r in rows if r.txn_type == "income")
        expense = sum(float(r.amount) for r in rows if r.txn_type == "expense")
        print(f"Seeded {DEMO_EMAIL} / {DEMO_PASSWORD}")
        print(f"  {len(rows)} transactions across {MONTHS} months")
        print(f"  income  Rs {income:,.0f}")
        print(f"  expense Rs {expense:,.0f}")
        print(f"  {len(budgets)} budgets, {len(GOALS)} savings goals")
        print("  2 deliberate anomalies injected (laptop purchase, dental procedure)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed FINWISE AI demo data")
    parser.add_argument("--reset", action="store_true",
                        help="delete the demo user and all its data first")
    seed(reset=parser.parse_args().reset)
