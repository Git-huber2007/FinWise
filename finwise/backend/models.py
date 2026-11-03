"""ORM models - the entire data layer.

Design notes
------------
* Money is ``Numeric(12, 2)``, never ``Float``. Binary floats cannot represent
  0.01 exactly, and a finance app that drifts by paise is wrong.
* Every user-owned table carries a non-nullable ``user_id`` FK. Authorization is
  enforced by always filtering on it; no endpoint accepts a user id from the
  client.
* Each model exposes ``to_dict()``. That is deliberately instead of a serializer
  layer: there is exactly one JSON shape per table, so a second abstraction
  would buy nothing.
"""
from datetime import date, datetime, timezone
from decimal import Decimal

from flask_login import UserMixin
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import CheckConstraint, UniqueConstraint
from werkzeug.security import check_password_hash, generate_password_hash

from constants import CATEGORIES

db = SQLAlchemy()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _f(value) -> float | None:
    """Decimal -> float at the JSON boundary only."""
    return None if value is None else float(value)


class User(db.Model, UserMixin):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(120), nullable=False)

    # Self-reported figures. Used by the health score when present, and clearly
    # labelled in the UI as user-supplied rather than derived from transactions.
    monthly_income = db.Column(db.Numeric(12, 2))
    emergency_fund = db.Column(db.Numeric(12, 2))

    is_demo = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=_now)

    transactions = db.relationship("Transaction", back_populates="user",
                                   cascade="all, delete-orphan", lazy="dynamic")
    budgets = db.relationship("Budget", back_populates="user",
                              cascade="all, delete-orphan", lazy="dynamic")
    goals = db.relationship("SavingsGoal", back_populates="user",
                            cascade="all, delete-orphan", lazy="dynamic")
    insights = db.relationship("FinancialInsight", back_populates="user",
                               cascade="all, delete-orphan", lazy="dynamic")
    preferences = db.relationship("UserPreference", back_populates="user",
                                  cascade="all, delete-orphan", uselist=False)

    def set_password(self, raw: str) -> None:
        self.password_hash = generate_password_hash(raw)

    def check_password(self, raw: str) -> bool:
        return check_password_hash(self.password_hash, raw)

    def to_dict(self) -> dict:
        # password_hash is never included.
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "monthly_income": _f(self.monthly_income),
            "emergency_fund": _f(self.emergency_fund),
            "is_demo": self.is_demo,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Transaction(db.Model):
    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_txn_amount_positive"),
        CheckConstraint("txn_type IN ('income', 'expense')", name="ck_txn_type"),
        db.Index("ix_txn_user_date", "user_id", "date"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"),
                        nullable=False, index=True)

    description = db.Column(db.String(255), nullable=False)
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    category = db.Column(db.String(40), nullable=False)
    txn_type = db.Column(db.String(10), nullable=False)
    date = db.Column(db.Date, nullable=False, default=date.today)
    payment_method = db.Column(db.String(40))
    notes = db.Column(db.Text)

    # Categorizer audit trail: what the model predicted, how sure it was, and
    # whether the user overrode it. was_corrected rows are the retraining set.
    ai_category = db.Column(db.String(40))
    ai_confidence = db.Column(db.Float)
    was_corrected = db.Column(db.Boolean, nullable=False, default=False)

    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=_now)

    user = db.relationship("User", back_populates="transactions")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "description": self.description,
            "amount": _f(self.amount),
            "category": self.category,
            "txn_type": self.txn_type,
            "date": self.date.isoformat() if self.date else None,
            "payment_method": self.payment_method,
            "notes": self.notes,
            "ai_category": self.ai_category,
            "ai_confidence": self.ai_confidence,
            "was_corrected": self.was_corrected,
        }


class Budget(db.Model):
    __tablename__ = "budgets"
    __table_args__ = (
        # One budget per category per month. category IS NULL means the overall
        # monthly budget. NOTE: SQLite treats NULLs as distinct in a UNIQUE
        # index, so this constraint does not block duplicate overall budgets --
        # routes/budgets.py enforces that case explicitly.
        UniqueConstraint("user_id", "category", "month", "year", name="uq_budget_period"),
        CheckConstraint("amount > 0", name="ck_budget_amount_positive"),
        CheckConstraint("month BETWEEN 1 AND 12", name="ck_budget_month"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"),
                        nullable=False, index=True)

    category = db.Column(db.String(40))  # NULL = overall monthly budget
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    month = db.Column(db.Integer, nullable=False)
    year = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=_now)

    user = db.relationship("User", back_populates="budgets")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "category": self.category,
            "amount": _f(self.amount),
            "month": self.month,
            "year": self.year,
            "is_overall": self.category is None,
        }


class SavingsGoal(db.Model):
    __tablename__ = "savings_goals"
    __table_args__ = (
        CheckConstraint("target_amount > 0", name="ck_goal_target_positive"),
        CheckConstraint("saved_amount >= 0", name="ck_goal_saved_nonneg"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"),
                        nullable=False, index=True)

    name = db.Column(db.String(120), nullable=False)
    target_amount = db.Column(db.Numeric(12, 2), nullable=False)
    saved_amount = db.Column(db.Numeric(12, 2), nullable=False, default=Decimal("0"))
    target_date = db.Column(db.Date)
    status = db.Column(db.String(20), nullable=False, default="active")  # active|achieved|archived
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=_now)

    user = db.relationship("User", back_populates="goals")

    @property
    def progress_pct(self) -> float:
        if not self.target_amount or float(self.target_amount) == 0:
            return 0.0
        return min(100.0, round(float(self.saved_amount) / float(self.target_amount) * 100, 1))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "target_amount": _f(self.target_amount),
            "saved_amount": _f(self.saved_amount),
            "remaining": _f((self.target_amount or 0) - (self.saved_amount or 0)),
            "target_date": self.target_date.isoformat() if self.target_date else None,
            "status": self.status,
            "progress_pct": self.progress_pct,
        }


class FinancialInsight(db.Model):
    """A generated insight, persisted so the Insights page has history.

    Always derived from the user's own rows by ai/analytics.py - never free text
    invented by an LLM.
    """
    __tablename__ = "financial_insights"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"),
                        nullable=False, index=True)

    kind = db.Column(db.String(40), nullable=False)      # trend|budget|anomaly|saving|health
    title = db.Column(db.String(200), nullable=False)
    body = db.Column(db.Text, nullable=False)
    severity = db.Column(db.String(20), nullable=False, default="info")  # info|warning|critical
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=_now)

    user = db.relationship("User", back_populates="insights")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "kind": self.kind,
            "title": self.title,
            "body": self.body,
            "severity": self.severity,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class UserPreference(db.Model):
    __tablename__ = "user_preferences"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"),
                        nullable=False, unique=True, index=True)

    theme = db.Column(db.String(10), nullable=False, default="dark")  # dark|light
    currency = db.Column(db.String(8), nullable=False, default="INR")
    alerts_enabled = db.Column(db.Boolean, nullable=False, default=True)

    user = db.relationship("User", back_populates="preferences")

    def to_dict(self) -> dict:
        return {"theme": self.theme, "currency": self.currency,
                "alerts_enabled": self.alerts_enabled}


# Re-exported so routes can validate without importing constants separately.
VALID_CATEGORIES = set(CATEGORIES)
