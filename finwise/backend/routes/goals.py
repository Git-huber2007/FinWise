"""Savings goal CRUD, with a projected completion date on every goal.

The projection is attached here rather than computed in the browser so that the
estimate, its caveats and its disclaimer travel together and cannot drift apart.

Authorization follows the same rule as every other blueprint: statements filter
on `SavingsGoal.user_id == current_user.id`, so another user's goal does not
exist rather than being forbidden.
"""
from decimal import Decimal
from typing import cast

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import select
from werkzeug.exceptions import NotFound

import validation as v
from ai import savings
from models import SavingsGoal, User, db
from routes.dashboard import user_rows

bp = Blueprint("goals", __name__, url_prefix="/api/goals")

STATUSES = ["active", "achieved", "archived"]


def _me() -> User:
    return cast(User, current_user)


def _owned_or_404(goal_id: int) -> SavingsGoal:
    goal = db.session.scalar(
        select(SavingsGoal).where(
            SavingsGoal.id == goal_id, SavingsGoal.user_id == _me().id
        )
    )
    if goal is None:
        raise NotFound("Savings goal not found.")
    return goal


def _sync_status(goal: SavingsGoal) -> None:
    """Flip between active and achieved to match the amounts.

    Kept in one place and called after every write: a goal whose saved amount
    reaches its target but still reads "active" is the sort of inconsistency
    that makes a user stop trusting the numbers. Archived is a user decision,
    so it is never overwritten.
    """
    if goal.status == "archived":
        return
    goal.status = "achieved" if goal.saved_amount >= goal.target_amount else "active"


def _with_projection(goals: list[SavingsGoal], monthly: float) -> list[dict]:
    out = []
    for goal in goals:
        payload = goal.to_dict()
        payload["projection"] = savings.project_goal(payload, monthly)
        out.append(payload)
    return out


def _monthly_rate() -> dict:
    """The savings forecast the goal projections are based on.

    Shared by the list endpoint and every write so that a goal's ETA never
    depends on which request happened to return it.
    """
    return savings.predict(user_rows(), horizon=3)


@bp.get("")
@login_required
def list_goals():
    goals = db.session.scalars(
        select(SavingsGoal)
        .where(SavingsGoal.user_id == _me().id)
        .order_by(SavingsGoal.status, SavingsGoal.created_at.desc())
    ).all()

    forecast = _monthly_rate()
    rate = float(forecast.get("predicted_next") or 0)
    rows = _with_projection(list(goals), rate)

    active = [g for g in rows if g["status"] == "active"]
    return jsonify(
        goals=rows,
        summary={
            "count": len(rows),
            "active": len(active),
            "achieved": sum(1 for g in rows if g["status"] == "achieved"),
            "total_target": round(sum(g["target_amount"] for g in active), 2),
            "total_saved": round(sum(g["saved_amount"] for g in active), 2),
            "total_remaining": round(sum(g["remaining"] for g in active), 2),
        },
        monthly_savings=round(rate, 2),
        forecast_method=forecast.get("method"),
        forecast_method_label=forecast.get("method_label"),
        # Every active goal projected from one monthly figure means they are
        # all competing for the same rupees. Said once, here, rather than
        # implied per goal.
        shared_rate_note=(
            "Each estimate assumes the whole of your monthly saving goes to that "
            "goal. With more than one active goal they are competing for the same "
            "money, so the real dates will be later."
            if len(active) > 1 else None
        ),
        disclaimer=savings.DISCLAIMER,
    )


@bp.post("")
@login_required
def create_goal():
    data = v.require_json(request)
    goal = SavingsGoal(
        user_id=_me().id,
        name=v.text(data, "name", max_len=120),
        target_amount=v.amount(data, "target_amount"),
        saved_amount=v.amount(data, "saved_amount", required=False) or Decimal("0"),
        target_date=v.iso_date(data, "target_date", required=False),
    )
    if goal.saved_amount > goal.target_amount:
        return jsonify(error="Saved amount cannot exceed the target amount.",
                       field="saved_amount"), 400

    _sync_status(goal)
    db.session.add(goal)
    db.session.commit()

    payload = goal.to_dict()
    payload["projection"] = savings.project_goal(
        payload, float(_monthly_rate().get("predicted_next") or 0)
    )
    return jsonify(payload), 201


@bp.put("/<int:goal_id>")
@login_required
def update_goal(goal_id: int):
    goal = _owned_or_404(goal_id)
    data = v.require_json(request)

    if "name" in data:
        goal.name = v.text(data, "name", max_len=120)
    if "target_amount" in data:
        goal.target_amount = v.amount(data, "target_amount")
    if "saved_amount" in data:
        goal.saved_amount = v.amount(data, "saved_amount")
    if "target_date" in data:
        goal.target_date = v.iso_date(data, "target_date", required=False)
    if "status" in data:
        status = v.choice(data, "status", STATUSES)
        goal.status = status
        # Leaving the archive is a return to the amounts deciding, so re-derive.
        if status != "archived":
            _sync_status(goal)
    else:
        _sync_status(goal)

    if goal.saved_amount > goal.target_amount:
        db.session.rollback()
        return jsonify(error="Saved amount cannot exceed the target amount.",
                       field="saved_amount"), 400

    db.session.commit()
    payload = goal.to_dict()
    payload["projection"] = savings.project_goal(
        payload, float(_monthly_rate().get("predicted_next") or 0)
    )
    return jsonify(payload)


@bp.post("/<int:goal_id>/contribute")
@login_required
def contribute(goal_id: int):
    """Add to a goal's saved amount.

    A separate endpoint from the full update because "I put 2,000 away this
    month" is the common action, and expressing it as a PUT would make the
    client read the current amount, add to it and write it back -- a
    read-modify-write race that would lose a contribution.
    """
    goal = _owned_or_404(goal_id)
    data = v.require_json(request)
    goal.saved_amount = min(goal.saved_amount + v.amount(data), goal.target_amount)
    _sync_status(goal)
    db.session.commit()

    payload = goal.to_dict()
    payload["projection"] = savings.project_goal(
        payload, float(_monthly_rate().get("predicted_next") or 0)
    )
    return jsonify(payload)


@bp.delete("/<int:goal_id>")
@login_required
def delete_goal(goal_id: int):
    goal = _owned_or_404(goal_id)
    db.session.delete(goal)
    db.session.commit()
    return jsonify(ok=True, deleted_id=goal_id)
