"""Transaction CRUD, search and filtering.

Every statement is built from `Transaction.user_id == current_user.id`. That
single habit is the whole authorization model -- a row belonging to someone
else is not forbidden, it simply does not exist as far as the query is
concerned, which is why cross-user access returns 404 rather than 403.

Written against SQLAlchemy 2.0's `select()` rather than the legacy
`Model.query` accessor: it composes better (the filter list below is built
once and reused for the page, the count and the totals) and it is statically
checkable, which the runtime-generated `.query` attribute is not.
"""
from typing import cast

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import func, or_, select
from werkzeug.exceptions import NotFound

import validation as v
from models import Transaction, User, db

bp = Blueprint("transactions", __name__, url_prefix="/api/transactions")

MAX_PAGE_SIZE = 200


def _me() -> User:
    """`current_user` is a LocalProxy; every use here is behind @login_required."""
    return cast(User, current_user)


def _owned_or_404(txn_id: int) -> Transaction:
    txn = db.session.scalar(
        select(Transaction).where(Transaction.id == txn_id, Transaction.user_id == _me().id)
    )
    if txn is None:
        # Deliberately 404, not 403: a 403 would confirm the row exists.
        raise NotFound("Transaction not found.")
    return txn


def _filters_from(args) -> list:
    """Translate query-string filters into SQL conditions.

    Returned as a list so the same conditions drive the page, the total count
    and the income/expense sums without being restated.
    """
    conditions = [Transaction.user_id == _me().id]

    search = (args.get("search") or "").strip()
    if search:
        # Escape so a user's literal % or _ is matched as a character rather
        # than acting as a LIKE wildcard.
        safe = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{safe}%"
        conditions.append(
            or_(
                Transaction.description.ilike(pattern, escape="\\"),
                Transaction.notes.ilike(pattern, escape="\\"),
            )
        )

    if category := args.get("category"):
        conditions.append(Transaction.category == v.category({"category": category}))
    if txn_type := args.get("txn_type"):
        conditions.append(Transaction.txn_type == v.txn_type({"txn_type": txn_type}))
    if start := args.get("start_date"):
        conditions.append(Transaction.date >= v.iso_date({"start_date": start}, "start_date"))
    if end := args.get("end_date"):
        conditions.append(Transaction.date <= v.iso_date({"end_date": end}, "end_date"))
    if method := args.get("payment_method"):
        conditions.append(Transaction.payment_method == method)

    return conditions


def _sum_for(conditions: list, txn_type: str) -> float:
    """Sum in SQL, not in Python.

    coalesce keeps an empty result as 0 instead of NULL, so the caller never
    has to special-case "no matching rows".
    """
    total = db.session.scalar(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            *conditions, Transaction.txn_type == txn_type
        )
    )
    return round(float(total or 0), 2)


@bp.get("")
@login_required
def list_transactions():
    """Filtered, paginated list. All filters are optional and combine with AND."""
    args = request.args
    conditions = _filters_from(args)

    total = db.session.scalar(select(func.count(Transaction.id)).where(*conditions)) or 0

    limit = v.integer(args, "limit", minimum=1, maximum=MAX_PAGE_SIZE, required=False, default=50)
    offset = v.integer(args, "offset", minimum=0, required=False, default=0)

    rows = db.session.scalars(
        select(Transaction)
        .where(*conditions)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()

    # Totals describe the whole filtered set, not just this page -- otherwise
    # the summary silently changes as the user pages through.
    income = _sum_for(conditions, "income")
    expense = _sum_for(conditions, "expense")

    return jsonify(
        transactions=[r.to_dict() for r in rows],
        total=total,
        limit=limit,
        offset=offset,
        totals={"income": income, "expense": expense, "net": round(income - expense, 2)},
    )


@bp.post("")
@login_required
def create_transaction():
    data = v.require_json(request)
    ai_category = data.get("ai_category")
    category = v.category(data)

    txn = Transaction(
        user_id=_me().id,
        description=v.text(data, "description"),
        amount=v.amount(data),
        category=category,
        txn_type=v.txn_type(data),
        date=v.iso_date(data, required=False, default_today=True),
        payment_method=v.payment_method(data),
        notes=v.text(data, "notes", required=False, max_len=2000),
        ai_category=ai_category,
        ai_confidence=data.get("ai_confidence"),
        # Records that the user overrode the model, which is the Phase 5
        # retraining signal. Only meaningful when a prediction was offered.
        was_corrected=bool(ai_category) and ai_category != category,
    )

    db.session.add(txn)
    db.session.commit()
    return jsonify(txn.to_dict()), 201


@bp.put("/<int:txn_id>")
@login_required
def update_transaction(txn_id: int):
    txn = _owned_or_404(txn_id)
    data = v.require_json(request)

    if "description" in data:
        txn.description = v.text(data, "description")
    if "amount" in data:
        txn.amount = v.amount(data)
    if "category" in data:
        new_category = v.category(data)
        if txn.ai_category and new_category != txn.ai_category:
            txn.was_corrected = True
        txn.category = new_category
    if "txn_type" in data:
        txn.txn_type = v.txn_type(data)
    if "date" in data:
        txn.date = v.iso_date(data)
    if "payment_method" in data:
        txn.payment_method = v.payment_method(data)
    if "notes" in data:
        txn.notes = v.text(data, "notes", required=False, max_len=2000)

    db.session.commit()
    return jsonify(txn.to_dict())


@bp.delete("/<int:txn_id>")
@login_required
def delete_transaction(txn_id: int):
    txn = _owned_or_404(txn_id)
    db.session.delete(txn)
    db.session.commit()
    return jsonify(ok=True, deleted_id=txn_id)
