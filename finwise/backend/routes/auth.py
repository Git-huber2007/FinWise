"""Authentication and profile endpoints."""
from typing import cast

from flask import Blueprint, jsonify, request, session
from flask_login import current_user, login_required, login_user, logout_user
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

import validation as v
from models import User, UserPreference, db

bp = Blueprint("auth", __name__, url_prefix="/api")


def _me() -> User:
    """`current_user` is a LocalProxy, so its real type is opaque.

    Every use here sits behind @login_required, which guarantees a real User.
    The cast states that once instead of at each call site; it is a typing
    annotation only and changes nothing at runtime.
    """
    return cast(User, current_user)


def _session_payload(user: User) -> dict:
    prefs = user.preferences.to_dict() if user.preferences else UserPreference().to_dict()
    return {"user": user.to_dict(), "preferences": prefs}


@bp.post("/register")
def register():
    data = v.require_json(request)
    name = v.text(data, "name", max_len=120)
    addr = v.email(data)
    pwd = v.password(data)
    income = v.money_or_none(data, "monthly_income")

    user = User(name=name, email=addr, monthly_income=income)
    user.set_password(pwd)
    db.session.add(user)
    db.session.add(UserPreference(user=user))

    try:
        db.session.commit()
    except IntegrityError:
        # The unique index is the real guard. A pre-check SELECT would still
        # race, and would also turn this endpoint into an account-enumeration
        # oracle with a different timing profile.
        db.session.rollback()
        return jsonify(error="An account with that email already exists.", field="email"), 409

    login_user(user, remember=True)
    session.permanent = True
    return jsonify(_session_payload(user)), 201


@bp.post("/login")
def login():
    data = v.require_json(request)
    addr = v.email(data)
    pwd = data.get("password")
    if not isinstance(pwd, str) or not pwd:
        raise v.ValidationError("Password is required.", "password")

    user = db.session.scalar(select(User).where(User.email == addr))
    # One message for both "no such user" and "wrong password", so the response
    # does not reveal which emails are registered.
    if user is None or not user.check_password(pwd):
        return jsonify(error="Incorrect email or password."), 401

    login_user(user, remember=True)
    session.permanent = True
    return jsonify(_session_payload(user))


@bp.post("/logout")
def logout():
    # Order matters, and getting it wrong fails open.
    #
    # We log in with remember=True, so Flask-Login also issues a remember-me
    # cookie. logout_user() signals that cookie's deletion by writing
    # session["_remember"] = "clear", which its after-request handler acts on.
    # Calling session.clear() AFTER logout_user() erases that instruction: the
    # session looks empty, but the surviving remember cookie silently
    # re-authenticates the very next request.
    #
    # So: drop our own session keys first, then let logout_user() have the
    # last word.
    session.clear()
    logout_user()
    return jsonify(ok=True)


@bp.get("/me")
@login_required
def me():
    return jsonify(_session_payload(_me()))


@bp.put("/me")
@login_required
def update_me():
    """Profile and the self-reported figures the health score uses."""
    data = v.require_json(request)
    user = _me()

    if "name" in data:
        user.name = v.text(data, "name", max_len=120)
    if "monthly_income" in data:
        user.monthly_income = v.money_or_none(data, "monthly_income")
    if "emergency_fund" in data:
        user.emergency_fund = v.money_or_none(data, "emergency_fund")

    # Email changes go through the unique index like registration does.
    if "email" in data and v.email(data) != user.email:
        user.email = v.email(data)

    prefs = user.preferences
    if prefs is None:
        prefs = UserPreference(user_id=user.id)
        db.session.add(prefs)
    if "theme" in data:
        prefs.theme = v.choice(data, "theme", ["dark", "light"])
    if "currency" in data:
        prefs.currency = v.choice(data, "currency", ["INR"])
    if "alerts_enabled" in data:
        prefs.alerts_enabled = bool(data["alerts_enabled"])

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(error="That email is already in use.", field="email"), 409

    return jsonify(_session_payload(user))


@bp.put("/me/password")
@login_required
def change_password():
    data = v.require_json(request)
    user = _me()
    current = data.get("current_password")
    if not isinstance(current, str) or not user.check_password(current):
        return jsonify(error="Your current password is incorrect.", field="current_password"), 401
    user.set_password(v.password(data, "new_password"))
    db.session.commit()
    return jsonify(ok=True)
