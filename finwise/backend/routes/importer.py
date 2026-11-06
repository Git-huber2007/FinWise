"""Smart CSV & Bank Statement Importer.

Parses CSV statements, auto-categorizes merchant descriptions locally via
Scikit-Learn (TF-IDF + ComplementNB), detects duplicates, and batch inserts
into the ledger.
"""
import csv
import io
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import cast

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import select

import validation as v
from ai.categorizer import predict as categorize_text
from constants import CATEGORIES
from models import Transaction, User, db

bp = Blueprint("importer", __name__, url_prefix="/api/import")


def _me() -> User:
    return cast(User, current_user)


def _parse_date(raw: str) -> date | None:
    raw = raw.strip()
    # Try various formats common in Indian bank statements
    formats = [
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%d/%m/%y",
        "%d-%m-%y",
        "%d %b %Y",
        "%d-%b-%Y",
        "%d %B %Y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


@bp.route("/preview", methods=["POST"])
@login_required
def preview_csv():
    """Parse CSV text or uploaded file, run ML categorizer, flag duplicates."""
    csv_text = ""
    if "file" in request.files:
        uploaded = request.files["file"]
        csv_text = uploaded.read().decode("utf-8", errors="replace")
    else:
        data = request.get_json(silent=True) or {}
        csv_text = data.get("csv_text") or data.get("csv_data") or ""

    if not csv_text.strip():
        raise v.ValidationError("Please provide CSV content to import.", "csv")

    user = _me()
    f = io.StringIO(csv_text.strip())
    reader = csv.reader(f)

    rows_raw = [r for r in reader if any(field.strip() for field in r)]
    if not rows_raw:
        raise v.ValidationError("The CSV file appears to be empty.", "csv")

    # Header detection
    headers = [h.strip().lower() for h in rows_raw[0]]
    start_idx = 1 if any(k in " ".join(headers) for k in ("date", "desc", "amount", "debit", "credit", "txn")) else 0

    # Map column indices
    date_col = next((i for i, h in enumerate(headers) if "date" in h), 0)
    desc_col = next((i for i, h in enumerate(headers) if any(k in h for k in ("desc", "particular", "narration", "merchant", "details"))), 1)
    amt_col = next((i for i, h in enumerate(headers) if any(k in h for k in ("amount", "amt", "debit", "inr"))), 2)
    type_col = next((i for i, h in enumerate(headers) if any(k in h for k in ("type", "dr/cr", "cr/dr", "txn_type"))), None)

    # Fetch existing transactions for duplicate detection
    recent_txns = db.session.scalars(
        select(Transaction).where(Transaction.user_id == user.id).order_by(Transaction.date.desc()).limit(500)
    ).all()
    existing_fingerprints = {
        (t.date.isoformat(), t.description.strip().lower(), float(t.amount)): t.id
        for t in recent_txns
    }

    parsed_rows = []
    for line_num, row in enumerate(rows_raw[start_idx:], start=start_idx + 1):
        if len(row) < 2:
            continue

        raw_date = row[date_col] if date_col < len(row) else ""
        raw_desc = row[desc_col] if desc_col < len(row) else ""
        raw_amt = row[amt_col] if amt_col < len(row) else ""

        parsed_d = _parse_date(raw_date) or date.today()
        desc = raw_desc.strip() or "Imported Transaction"

        # Amount cleaning (strip currency symbols, commas, spaces)
        clean_amt_str = re.sub(r"[^\d.]", "", raw_amt)
        try:
            amt = round(float(clean_amt_str), 2)
            if amt <= 0:
                continue
        except (ValueError, TypeError):
            continue

        # Transaction type inference
        txn_type = "expense"
        if type_col is not None and type_col < len(row):
            raw_type = row[type_col].strip().lower()
            if any(k in raw_type for k in ("cr", "credit", "deposit", "income")):
                txn_type = "income"
        elif "salary" in desc.lower() or "deposit" in desc.lower() or "dividend" in desc.lower():
            txn_type = "income"

        # Local Scikit-Learn ML categorization
        pred = categorize_text(desc)
        cat_pred = pred.category
        conf = pred.confidence
        assigned_cat = cat_pred if conf >= 0.3 else ("Salary" if txn_type == "income" else "Other")

        # Duplicate check
        is_dup = (parsed_d.isoformat(), desc.lower(), amt) in existing_fingerprints

        parsed_rows.append({
            "line": line_num,
            "date": parsed_d.isoformat(),
            "description": desc,
            "amount": amt,
            "category": assigned_cat,
            "predicted_category": assigned_cat,
            "confidence": round(conf, 2),
            "txn_type": txn_type,
            "payment_method": "UPI" if "upi" in desc.lower() else "Debit Card",
            "is_duplicate": is_dup,
        })

    return jsonify({
        "total_parsed": len(parsed_rows),
        "total_rows": len(parsed_rows),
        "duplicates_flagged": sum(1 for r in parsed_rows if r["is_duplicate"]),
        "rows": parsed_rows,
    })


@bp.route("/commit", methods=["POST"])
@login_required
def commit_import():
    """Batch insert confirmed rows into the ledger."""
    data = v.require_json(request)
    rows = data.get("rows", [])
    if not isinstance(rows, list) or not rows:
        raise v.ValidationError("No rows provided for import.", "rows")

    user = _me()
    created_txns = []
    valid_cats = set(CATEGORIES)

    for item in rows:
        try:
            amt = Decimal(str(item.get("amount", 0))).quantize(Decimal("0.01"))
            if amt <= 0:
                continue
        except (InvalidOperation, ValueError):
            continue

        d_str = item.get("date")
        d = _parse_date(d_str) if d_str else date.today()
        cat = item.get("category") or item.get("predicted_category") or "Other"
        if cat not in valid_cats:
            cat = "Other"

        t = Transaction(
            user_id=user.id,
            description=item.get("description", "Imported Entry")[:255],
            amount=amt,
            category=cat,
            txn_type="income" if item.get("txn_type") == "income" else "expense",
            date=d or date.today(),
            payment_method=item.get("payment_method") or "Debit Card",
            ai_category=cat,
            ai_confidence=float(item.get("confidence") or 0.0),
            notes=f"Batch imported via CSV Statement Importer on {date.today().isoformat()}.",
        )
        created_txns.append(t)

    db.session.add_all(created_txns)
    db.session.commit()

    return jsonify({
        "success": True,
        "imported_count": len(created_txns),
        "inserted_count": len(created_txns),
    }), 201
