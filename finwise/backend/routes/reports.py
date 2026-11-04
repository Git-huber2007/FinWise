"""Report endpoints: monthly JSON, the same report as a PDF, and a CSV export.

All three are scoped to `current_user.id` like every other blueprint. The PDF
and the JSON are rendered from one `build_report()` call, so a downloaded
report cannot disagree with the page it was downloaded from.
"""
from typing import cast

from flask import Blueprint, Response, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import select

import reporting
from models import SavingsGoal, Transaction, User, db
from routes.dashboard import resolve_month, user_budgets, user_rows

# Reusing the transaction blueprint's filter builder rather than restating it.
# The CSV export must honour exactly the filters the user had applied on the
# Transactions page; a second implementation would drift from the first.
from routes.transactions import _filters_from

bp = Blueprint("reports", __name__, url_prefix="/api/reports")


def _me() -> User:
    return cast(User, current_user)


def _report(month: str | None = None) -> dict:
    rows = user_rows()
    goals = [g.to_dict() for g in db.session.scalars(
        select(SavingsGoal).where(SavingsGoal.user_id == _me().id)
    ).all()]
    user = _me()
    return reporting.build_report(
        rows,
        budgets=user_budgets(),
        goals=goals,
        user={"name": user.name, "email": user.email, "is_demo": user.is_demo,
              "emergency_fund": user.emergency_fund},
        month=resolve_month(rows, month),
    )


@bp.get("/monthly")
@login_required
def monthly():
    """The full monthly report as JSON, for the Reports page preview."""
    return jsonify(_report(request.args.get("month")))


@bp.get("/monthly.pdf")
@login_required
def monthly_pdf():
    report = _report(request.args.get("month"))
    pdf = reporting.render_pdf(report)
    filename = reporting.pdf_filename(report["meta"]["month"])
    return Response(
        pdf,
        mimetype="application/pdf",
        headers={
            # `attachment` so the browser saves it rather than navigating the
            # SPA away to a PDF viewer and losing the user's place.
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf)),
        },
    )


@bp.get("/transactions.csv")
@login_required
def transactions_csv():
    """Every transaction matching the current filters, oldest first.

    Not paginated: an export that silently stopped at the first 50 rows would
    be worse than no export, because the file looks complete.
    """
    rows = db.session.scalars(
        select(Transaction)
        .where(*_filters_from(request.args))
        .order_by(Transaction.date, Transaction.id)
    ).all()

    body = reporting.render_csv([r.to_dict() for r in rows])
    filename = reporting.csv_filename()
    return Response(
        # utf-8-sig: Excel on Windows assumes the system codepage without a
        # BOM, which mangles any non-ASCII description in the export.
        body.encode("utf-8-sig"),
        # content_type, not mimetype: Flask appends its own charset to a
        # mimetype, which produced "text/csv; charset=utf-8; charset=utf-8".
        content_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Row-Count": str(len(rows)),
        },
    )
