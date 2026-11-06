"""ORM models - the entire data layer.

Design notes
------------
* Written in SQLAlchemy 2.0 typed declarative style (``Mapped[...]`` +
  ``mapped_column``). Beyond being the modern idiom, it makes the ORM emit a
  correctly-typed ``__init__``, so type checkers can verify constructor
  keywords instead of reporting every one of them against ``object.__init__``.
* Money is ``Numeric(12, 2)`` mapped to ``Decimal``, never ``Float``. Binary
  floats cannot represent 0.01 exactly, and a finance app that drifts by paise
  is wrong.
* Every user-owned table carries a non-nullable ``user_id`` FK. Authorization
  is enforced by always filtering on it; no endpoint accepts a user id from the
  client.
* Each model exposes ``to_dict()``. That is deliberately instead of a
  serializer layer: there is exactly one JSON shape per table, so a second
  abstraction would buy nothing.
"""
from datetime import date, datetime, timezone
from decimal import Decimal

from flask_login import UserMixin
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from werkzeug.security import check_password_hash, generate_password_hash

from constants import CATEGORIES


class Base(DeclarativeBase):
    """Explicit declarative base, handed to Flask-SQLAlchemy.

    Models inherit from this directly rather than from ``db.Model``.
    ``db.Model`` is assembled by Flask-SQLAlchemy at runtime, so a type checker
    sees only an opaque base, synthesises no ``__init__``, and reports every
    constructor keyword as an error against ``object.__init__``.

    The trade-off: ``Base`` does not carry Flask-SQLAlchemy's legacy ``.query``
    accessor. Queries therefore use SQLAlchemy 2.0's ``select()`` through
    ``db.session``, which is the modern idiom anyway and composes far better
    for the filtered listing in routes/transactions.py.
    """


db = SQLAlchemy(model_class=Base)

# Reusable column types.
Money = Numeric(12, 2)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _f(value: Decimal | float | None) -> float | None:
    """Decimal -> float at the JSON boundary only."""
    return None if value is None else float(value)


class User(Base, UserMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)

    # Self-reported figures. Used by the health score when present, and clearly
    # labelled in the UI as user-supplied rather than derived from transactions.
    monthly_income: Mapped[Decimal | None] = mapped_column(Money, nullable=True)
    emergency_fund: Mapped[Decimal | None] = mapped_column(Money, nullable=True)

    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )

    transactions: Mapped[list["Transaction"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    budgets: Mapped[list["Budget"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    goals: Mapped[list["SavingsGoal"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    insights: Mapped[list["FinancialInsight"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    subscriptions: Mapped[list["Subscription"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    assets: Mapped[list["Asset"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    debts: Mapped[list["Debt"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    preferences: Mapped["UserPreference | None"] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )

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


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_txn_amount_positive"),
        CheckConstraint("txn_type IN ('income', 'expense')", name="ck_txn_type"),
        Index("ix_txn_user_date", "user_id", "date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    description: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Money, nullable=False)
    category: Mapped[str] = mapped_column(String(40), nullable=False)
    txn_type: Mapped[str] = mapped_column(String(10), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    payment_method: Mapped[str | None] = mapped_column(String(40), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Categorizer audit trail: what the model predicted, how sure it was, and
    # whether the user overrode it. was_corrected rows are the retraining set.
    ai_category: Mapped[str | None] = mapped_column(String(40), nullable=True)
    ai_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    was_corrected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )

    user: Mapped["User"] = relationship(back_populates="transactions")

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


class Budget(Base):
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

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    category: Mapped[str | None] = mapped_column(String(40), nullable=True)  # NULL = overall
    amount: Mapped[Decimal] = mapped_column(Money, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )

    user: Mapped["User"] = relationship(back_populates="budgets")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "category": self.category,
            "amount": _f(self.amount),
            "month": self.month,
            "year": self.year,
            "is_overall": self.category is None,
        }


class SavingsGoal(Base):
    __tablename__ = "savings_goals"
    __table_args__ = (
        CheckConstraint("target_amount > 0", name="ck_goal_target_positive"),
        CheckConstraint("saved_amount >= 0", name="ck_goal_saved_nonneg"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    target_amount: Mapped[Decimal] = mapped_column(Money, nullable=False)
    saved_amount: Mapped[Decimal] = mapped_column(Money, nullable=False, default=Decimal("0"))
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # active | achieved | archived
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )

    user: Mapped["User"] = relationship(back_populates="goals")

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
            "remaining": _f((self.target_amount or Decimal("0")) - (self.saved_amount or Decimal("0"))),
            "target_date": self.target_date.isoformat() if self.target_date else None,
            "status": self.status,
            "progress_pct": self.progress_pct,
        }


class FinancialInsight(Base):
    """A generated insight, persisted so the Insights page has history.

    Always derived from the user's own rows by ai/analytics.py - never free text
    invented by an LLM.
    """

    __tablename__ = "financial_insights"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # trend | budget | anomaly | saving | health
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    # info | warning | critical
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="info")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )

    user: Mapped["User"] = relationship(back_populates="insights")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "kind": self.kind,
            "title": self.title,
            "body": self.body,
            "severity": self.severity,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )

    theme: Mapped[str] = mapped_column(String(10), nullable=False, default="dark")  # dark | light
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="INR")
    alerts_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    user: Mapped["User"] = relationship(back_populates="preferences")

    def to_dict(self) -> dict:
        return {
            "theme": self.theme,
            "currency": self.currency,
            "alerts_enabled": self.alerts_enabled,
        }




class Subscription(Base):
    __tablename__ = "subscriptions"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_sub_amount_positive"),
        CheckConstraint("billing_cycle IN ('weekly', 'monthly', 'quarterly', 'yearly')", name="ck_sub_cycle"),
        CheckConstraint("status IN ('active', 'paused', 'cancelled')", name="ck_sub_status"),
        Index("ix_sub_user_next_date", "user_id", "next_billing_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Money, nullable=False)
    category: Mapped[str] = mapped_column(String(40), nullable=False, default="Subscriptions")
    billing_cycle: Mapped[str] = mapped_column(String(20), nullable=False, default="monthly")
    next_billing_date: Mapped[date] = mapped_column(Date, nullable=False)
    payment_method: Mapped[str | None] = mapped_column(String(40), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now
    )

    user: Mapped["User"] = relationship(back_populates="subscriptions")

    @property
    def monthly_cost(self) -> float:
        amt = float(self.amount or 0)
        if self.billing_cycle == "yearly":
            return round(amt / 12, 2)
        elif self.billing_cycle == "quarterly":
            return round(amt / 3, 2)
        elif self.billing_cycle == "weekly":
            return round(amt * 52 / 12, 2)
        return round(amt, 2)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "amount": _f(self.amount),
            "category": self.category,
            "billing_cycle": self.billing_cycle,
            "next_billing_date": self.next_billing_date.isoformat() if self.next_billing_date else None,
            "payment_method": self.payment_method,
            "status": self.status,
            "notes": self.notes,
            "monthly_cost": self.monthly_cost,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }




class Asset(Base):
    __tablename__ = "assets"
    __table_args__ = (
        CheckConstraint("balance >= 0", name="ck_asset_balance_nonneg"),
        Index("ix_asset_user_type", "user_id", "asset_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    # cash, bank, investment, retirement, gold, property, other
    asset_type: Mapped[str] = mapped_column(String(40), nullable=False, default="bank")
    balance: Mapped[Decimal] = mapped_column(Money, nullable=False, default=Decimal("0"))
    institution: Mapped[str | None] = mapped_column(String(80), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, onupdate=_now
    )

    user: Mapped["User"] = relationship(back_populates="assets")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "asset_type": self.asset_type,
            "balance": _f(self.balance),
            "institution": self.institution,
            "notes": self.notes,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Debt(Base):
    __tablename__ = "debts"
    __table_args__ = (
        CheckConstraint("current_balance >= 0", name="ck_debt_balance_nonneg"),
        CheckConstraint("interest_rate >= 0", name="ck_debt_rate_nonneg"),
        Index("ix_debt_user_type", "user_id", "debt_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    # credit_card, home_loan, personal_loan, auto_loan, education_loan, other
    debt_type: Mapped[str] = mapped_column(String(40), nullable=False, default="credit_card")
    principal_amount: Mapped[Decimal] = mapped_column(Money, nullable=False)
    current_balance: Mapped[Decimal] = mapped_column(Money, nullable=False)
    interest_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    minimum_payment: Mapped[Decimal] = mapped_column(Money, nullable=False)
    due_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    institution: Mapped[str | None] = mapped_column(String(80), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, onupdate=_now
    )

    user: Mapped["User"] = relationship(back_populates="debts")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "debt_type": self.debt_type,
            "principal_amount": _f(self.principal_amount),
            "current_balance": _f(self.current_balance),
            "interest_rate": float(self.interest_rate or 0),
            "minimum_payment": _f(self.minimum_payment),
            "due_day": self.due_day,
            "institution": self.institution,
            "notes": self.notes,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# Re-exported so routes can validate without importing constants separately.
VALID_CATEGORIES = set(CATEGORIES)
