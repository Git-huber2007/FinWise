"""Schema-level guarantees.

These test the things that are easy to get wrong once and never notice: money
precision, password handling, constraint enforcement and cascade behaviour.
"""
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError

from models import Budget, FinancialInsight, SavingsGoal, Transaction, User, db


# --------------------------------------------------------------------------
# Money precision
# --------------------------------------------------------------------------

def test_amount_keeps_exact_paise(app, user):
    """The classic float bug: 0.1 + 0.2 != 0.3. Numeric must not drift."""
    for raw in ("0.01", "1234.56", "99999999.99"):
        t = Transaction(user_id=user.id, description="precision probe",
                        amount=Decimal(raw), category="Other",
                        txn_type="expense", date=date(2026, 1, 1))
        db.session.add(t)
    db.session.commit()

    stored = [t.amount for t in Transaction.query.order_by(Transaction.amount).all()]
    assert stored == [Decimal("0.01"), Decimal("1234.56"), Decimal("99999999.99")]


def test_summing_many_small_amounts_is_exact(app, user):
    """100 x 0.01 must be exactly 1.00, not 1.0000000000000002."""
    for _ in range(100):
        db.session.add(Transaction(user_id=user.id, description="paise",
                                   amount=Decimal("0.01"), category="Other",
                                   txn_type="expense", date=date(2026, 1, 1)))
    db.session.commit()
    total = sum((t.amount for t in Transaction.query.all()), Decimal("0"))
    assert total == Decimal("1.00")


# --------------------------------------------------------------------------
# Passwords
# --------------------------------------------------------------------------

def test_password_is_hashed_not_stored(user):
    assert user.password_hash != "correct-horse-battery"
    assert "correct-horse-battery" not in user.password_hash
    assert user.check_password("correct-horse-battery")
    assert not user.check_password("wrong")


def test_same_password_gives_different_hashes(app):
    """A per-user salt means two identical passwords must not look identical."""
    a, b = User(email="a@x.com", name="A"), User(email="b@x.com", name="B")
    a.set_password("same-password")
    b.set_password("same-password")
    assert a.password_hash != b.password_hash


def test_to_dict_never_leaks_the_hash(user):
    payload = user.to_dict()
    assert "password_hash" not in payload
    assert "password" not in payload
    assert payload["email"] == "asha@example.com"


# --------------------------------------------------------------------------
# Constraints
# --------------------------------------------------------------------------

@pytest.mark.parametrize("bad_amount", [Decimal("0"), Decimal("-50.00")])
def test_non_positive_amount_is_rejected(app, user, bad_amount):
    db.session.add(Transaction(user_id=user.id, description="bad", amount=bad_amount,
                               category="Other", txn_type="expense", date=date(2026, 1, 1)))
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


def test_invalid_txn_type_is_rejected(app, user):
    db.session.add(Transaction(user_id=user.id, description="bad type",
                               amount=Decimal("10"), category="Other",
                               txn_type="refund", date=date(2026, 1, 1)))
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


def test_duplicate_email_is_rejected(app, user):
    clash = User(email="asha@example.com", name="Impostor")
    clash.set_password("x")
    db.session.add(clash)
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


def test_duplicate_category_budget_for_one_month_is_rejected(app, user):
    for _ in range(2):
        db.session.add(Budget(user_id=user.id, category="Food",
                              amount=Decimal("4000"), month=3, year=2026))
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


def test_month_outside_1_to_12_is_rejected(app, user):
    db.session.add(Budget(user_id=user.id, category="Food",
                          amount=Decimal("4000"), month=13, year=2026))
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


# --------------------------------------------------------------------------
# User isolation and cascade
# --------------------------------------------------------------------------

def test_transactions_are_scoped_to_their_owner(app, user, other_user):
    db.session.add(Transaction(user_id=user.id, description="Asha's lunch",
                               amount=Decimal("250"), category="Food",
                               txn_type="expense", date=date(2026, 2, 1)))
    db.session.add(Transaction(user_id=other_user.id, description="Vikram's fuel",
                               amount=Decimal("900"), category="Transportation",
                               txn_type="expense", date=date(2026, 2, 1)))
    db.session.commit()

    asha = Transaction.query.filter_by(user_id=user.id).all()
    assert len(asha) == 1 and asha[0].description == "Asha's lunch"
    # The query a route would run for a row it does not own returns nothing.
    assert Transaction.query.filter_by(id=asha[0].id, user_id=other_user.id).first() is None


def test_foreign_keys_are_actually_enforced(app, user):
    """SQLite silently ignores FK constraints unless PRAGMA foreign_keys=ON.

    Raw SQL on purpose: the ORM would never build this row, and the point is to
    prove the *database* rejects it, not that SQLAlchemy does. The row is
    otherwise complete so the only thing wrong with it is the dangling user_id
    -- an incomplete row would fail on NOT NULL first and prove nothing.
    """
    from sqlalchemy import text

    assert db.session.execute(text("PRAGMA foreign_keys")).scalar() == 1

    with pytest.raises(IntegrityError) as exc:
        db.session.execute(text(
            "INSERT INTO transactions "
            "(user_id,description,amount,category,txn_type,date,was_corrected,created_at) "
            "VALUES (99999,'orphan',10,'Other','expense','2026-01-01',0,'2026-01-01 00:00:00')"))
        db.session.commit()
    assert "FOREIGN KEY" in str(exc.value).upper()
    db.session.rollback()


def test_deleting_a_user_removes_all_their_rows(app, user):
    db.session.add(Transaction(user_id=user.id, description="x", amount=Decimal("1"),
                               category="Other", txn_type="expense", date=date(2026, 1, 1)))
    db.session.add(Budget(user_id=user.id, category="Food", amount=Decimal("1000"),
                          month=1, year=2026))
    db.session.add(SavingsGoal(user_id=user.id, name="Laptop",
                               target_amount=Decimal("60000")))
    db.session.add(FinancialInsight(user_id=user.id, kind="trend", title="t", body="b"))
    db.session.commit()

    db.session.delete(user)
    db.session.commit()

    assert Transaction.query.count() == 0
    assert Budget.query.count() == 0
    assert SavingsGoal.query.count() == 0
    assert FinancialInsight.query.count() == 0


# --------------------------------------------------------------------------
# Derived values
# --------------------------------------------------------------------------

def test_goal_progress_percentage(app, user):
    g = SavingsGoal(user_id=user.id, name="Vacation",
                    target_amount=Decimal("50000"), saved_amount=Decimal("12500"))
    db.session.add(g)
    db.session.commit()
    assert g.progress_pct == 25.0
    assert g.to_dict()["remaining"] == 37500.0


def test_goal_progress_caps_at_100(app, user):
    g = SavingsGoal(user_id=user.id, name="Overshot",
                    target_amount=Decimal("1000"), saved_amount=Decimal("2500"))
    db.session.add(g)
    db.session.commit()
    assert g.progress_pct == 100.0


def test_goal_progress_handles_zero_target_without_dividing_by_zero(app, user):
    g = SavingsGoal(user_id=user.id, name="Edge", target_amount=Decimal("1"))
    g.target_amount = Decimal("0")  # bypass the CHECK to exercise the guard
    assert g.progress_pct == 0.0


def test_to_dict_returns_json_safe_types(app, user):
    t = Transaction(user_id=user.id, description="Swiggy order",
                    amount=Decimal("349.50"), category="Food",
                    txn_type="expense", date=date(2026, 5, 9),
                    payment_method="UPI", ai_confidence=0.91)
    db.session.add(t)
    db.session.commit()

    d = t.to_dict()
    assert isinstance(d["amount"], float) and d["amount"] == 349.50
    assert d["date"] == "2026-05-09"
    import json
    json.dumps(d)  # must not raise
