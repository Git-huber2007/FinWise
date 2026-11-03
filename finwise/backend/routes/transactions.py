"""Transaction CRUD, search and filtering.

Every query starts from `Transaction.query.filter_by(user_id=current_user.id)`.
That single habit is the whole authorization model -- a row belonging to
someone else is not forbidden, it simply does not exist as far as the query is
concerned, which is why cross-user access returns 404 rather than 403.
"""
from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

import validation as v
from models import Transaction, db

bp = Blueprint("transactions", __name__, url_prefix="/api/transactions")

MAX_PAGE_SIZE = 200


def _owned_or_404(txn_id: int) -> Transaction:
    txn = Transaction.query.filter_by(id=txn_id, user_id=current_user.id).first()
    if txn is None:
        # Deliberately 404, not 403: a 403 would confirm the row exists.
        from werkzeug.exceptions import NotFound

        raise NotFound("Transaction not found.")
    return txn


@bp.get("")
@login_required
def list_transactions():
    """Filtered, paginated list. All filters are optional and combine with AND."""
    args = request.args
    query = Transaction.query.filter_by(user_id=current_user.id)

    search = (args.get("search") or "").strip()
    if search:
        # ilike handles case-insensitivity; the escape stops a user's literal
        # % or _ from acting as a wildcard.
        safe = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{safe}%"
        query = query.filter(
            db.or_(
                Transaction.description.ilike(pattern, escape="\\"),
                Transaction.notes.ilike(pattern, escape="\\"),
            )
        )

    if category := args.get("category"):
        query = query.filter(Transaction.category == v.category({"category": category}))
    if txn_type := args.get("txn_type"):
        query = query.filter(Transaction.txn_type == v.txn_type({"txn_type": txn_type}))
    if start := args.get("start_date"):
        query = query.filter(Transaction.date >= v.iso_date({"start_date": start}, "start_date"))
    if end := args.get("end_date"):
        query = query.filter(Transaction.date <= v.iso_date({"end_date": end}, "end_date"))
    if method := args.get("payment_method"):
        query = query.filter(Transaction.payment_method == method)

    total = query.count()

    limit = v.integer(args, "limit", minimum=1, maximum=MAX_PAGE_SIZE, required=False, default=50)
    offset = v.integer(args, "offset", minimum=0, required=False, default=0)

    rows = (
        query.order_by(Transaction.date.desc(), Transaction.id.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )

    # Totals describe the whole filtered set, not just this page -- otherwise
    # the summary silently changes as the user pages through.
    income = sum(float(r.amount) for r in query.filter_by(txn_type="income"))
    expense = sum(float(r.amount) for r in query.filter_by(txn_type="expense"))

    return jsonify(
        transactions=[r.to_dict() for r in rows],
        total=total,
        limit=limit,
        offset=offset,
        totals={"income": round(income, 2), "expense": round(expense, 2),
                "net": round(income - expense, 2)},
    )


@bp.post("")
@login_required
def create_transaction():
    data = v.require_json(request)
    txn = Transaction(
        user_id=current_user.id,
        description=v.text(data, "description"),
        amount=v.amount(data),
        category=v.category(data),
        txn_type=v.txn_type(data),
        date=v.iso_date(data, default_today=True),
        payment_method=v.payment_method(data),
        notes=v.text(data, "notes", required=False, max_len=2000),
        ai_category=data.get("ai_category"),
        ai_confidence=data.get("ai_confidence"),
    )
    # Records that the user overrode the model, which is the Phase 5 retraining
    # signal. Only meaningful when a prediction was actually offered.
    txn.was_corrected = bool(txn.ai_category) and txn.ai_category != txn.category

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
