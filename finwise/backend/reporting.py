"""Monthly report assembly, PDF rendering and CSV export.

`build_report` is a pure function over plain dicts, so the JSON endpoint, the
PDF and the tests all consume the identical structure. A PDF that disagreed
with the page it was downloaded from would be worse than no PDF at all.

On the rupee sign
-----------------
The PDF writes "Rs." rather than the glyph. reportlab's built-in Helvetica is a
Type 1 font with WinAnsi encoding, which has no U+20B9, and none of the four
TrueType fonts reportlab ships (the Bitstream Vera family) contain it either --
Vera predates the symbol. 88 fonts on this Windows machine do have it, but
depending on a system font makes PDF generation work on the developer's laptop
and fail on the marker's. "Rs." is standard notation in Indian financial
documents and renders identically everywhere; a missing-glyph box would not.
The web UI is unaffected and keeps the real symbol.
"""
from __future__ import annotations

import csv
import io
from datetime import date, datetime, timezone

from ai import analytics, anomaly, health, savings

# Columns exported to CSV, in order. Explicit rather than derived from the
# model so that adding an internal column does not silently change the shape of
# a file users may already have scripts pointed at.
CSV_COLUMNS = [
    "date", "description", "category", "txn_type", "amount",
    "payment_method", "notes", "ai_category", "ai_confidence", "was_corrected",
]

SAMPLE_DATA_NOTICE = (
    "This report was generated from seeded demonstration data, not from real "
    "financial records."
)

REPORT_DISCLAIMER = (
    "FINWISE AI is an educational project. Every figure in this report is "
    "computed from the transactions recorded in the application. The financial "
    "health score is not a credit score or a professional financial "
    "assessment, and the savings figures are estimates, not guarantees."
)


def _rupees(value) -> str:
    """Indian digit grouping with an ASCII currency prefix. See module docstring."""
    try:
        amount = float(value or 0)
    except (TypeError, ValueError):
        return "Rs. 0.00"
    sign = "-" if amount < 0 else ""
    whole, _, frac = f"{abs(amount):.2f}".partition(".")
    if len(whole) > 3:
        # Indian grouping: last three digits, then pairs. 1234567 -> 12,34,567
        head, tail = whole[:-3], whole[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        whole = ",".join(groups + [tail])
    return f"{sign}Rs. {whole}.{frac}"


def _plain(text) -> str:
    """Make a string safe for the PDF's Helvetica.

    Text reaching the PDF is not all formatted by `_rupees`. The health
    explanations, the generated insights and the anomaly reasons are built by
    the ai/* modules, which correctly use the real rupee sign because they also
    feed the web UI -- and a user's own transaction description may contain
    anything at all. Helvetica cannot encode U+20B9, and reportlab renders what
    it cannot encode as a filled black box, so the first PDF read
    "spending varies around [box]52,335".

    Fixing it here, at the one boundary where text becomes a PDF, keeps the
    rupee sign everywhere it works and removes it only where it does not.
    """
    if not isinstance(text, str):
        text = str(text)
    text = text.replace("₹", "Rs. ")
    # Anything else outside the font's encoding would be a box too. Replacing
    # it with "?" is ugly but legible, which a black box is not.
    return text.encode("cp1252", errors="replace").decode("cp1252")


def build_report(rows, *, budgets, goals, user, month: str) -> dict:
    """Everything a monthly report contains, computed once.

    Deliberately assembled from the same ai/* functions the dashboard uses
    rather than recomputing anything locally: a report whose totals differ from
    the screen the user was just looking at destroys trust in both.
    """
    series = analytics.monthly_series(rows)
    index = next((i for i, m in enumerate(series) if m["month"] == month), None)
    previous = series[index - 1]["month"] if index not in (None, 0) else None

    month_rows = analytics.filter_month(rows, month)
    month_rows = sorted(month_rows, key=lambda r: (r["date"] or "", r["id"]))

    score = health.financial_health(
        rows, budgets=budgets, emergency_fund=user.get("emergency_fund"), current=month
    )
    forecast = savings.predict(rows, horizon=3)
    rate = float(forecast.get("predicted_next") or 0)

    return {
        "meta": {
            "month": month,
            "month_label": analytics.month_label(month),
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "user_name": user.get("name"),
            "user_email": user.get("email"),
            # Surfaced so the PDF can stamp it. Presenting seeded figures as
            # real financial records would be the dishonest part of a demo.
            "is_sample_data": bool(user.get("is_demo")),
            "sample_notice": SAMPLE_DATA_NOTICE if user.get("is_demo") else None,
            "partial_month": analytics.is_current_month(month),
            # Every month the user has data for, newest first, so the Reports
            # page can offer a selector without a second round trip.
            "available_months": [
                {"month": m["month"], "label": m["label"]} for m in reversed(series)
            ],
            "disclaimer": REPORT_DISCLAIMER,
        },
        "totals": analytics.totals_for(month_rows),
        "previous_month": previous,
        "previous_totals": (
            analytics.totals_for(analytics.filter_month(rows, previous)) if previous else None
        ),
        "category_breakdown": analytics.category_breakdown(month_rows),
        "comparison": analytics.month_over_month(rows, month, previous) if previous else [],
        "budget_alerts": analytics.budget_alerts(rows, budgets, month),
        "health": {
            "score": score["score"],
            "band": score["band"],
            "provisional": score["provisional"],
            "components": score["components"],
            "disclaimer": score["disclaimer"],
        },
        "forecast": {
            "method": forecast["method"],
            "method_label": forecast["method_label"],
            "confidence": forecast["confidence"],
            "predicted_next": forecast.get("predicted_next"),
            "explanation": forecast["explanation"],
            "disclaimer": forecast["disclaimer"],
        },
        "goals": [savings.project_goal(g, rate) for g in goals if g.get("status") == "active"],
        "anomalies": anomaly.detect(rows, month=month),
        "insights": analytics.generate_insights(rows, current=month, budgets=budgets, limit=8),
        "transactions": month_rows,
        "has_data": bool(month_rows),
    }


# --------------------------------------------------------------------------
# CSV
# --------------------------------------------------------------------------

def render_csv(rows) -> str:
    """Transactions as CSV.

    `lineterminator` is set because csv defaults to \\r\\n and Flask would then
    send \\r\\r\\n once the response is normalised, which some parsers read as a
    blank row between every record.
    """
    buffer = io.StringIO()
    writer = csv.DictWriter(
        buffer, fieldnames=CSV_COLUMNS, extrasaction="ignore", lineterminator="\n"
    )
    writer.writeheader()
    for row in rows:
        writer.writerow({key: row.get(key) for key in CSV_COLUMNS})
    return buffer.getvalue()


def csv_filename(prefix: str = "finwise-transactions") -> str:
    return f"{prefix}-{date.today():%Y-%m-%d}.csv"


# --------------------------------------------------------------------------
# PDF
# --------------------------------------------------------------------------

def render_pdf(report: dict) -> bytes:
    """The monthly report as a PDF.

    Imported inside the function: reportlab pulls in a sizeable amount at import
    time, and the JSON and CSV endpoints have no reason to pay for it.
    """
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        CondPageBreak,
        HRFlowable,
        KeepTogether,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    meta = report["meta"]
    totals = report["totals"]

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        title=f"FINWISE AI report - {meta['month_label']}",
        author="FINWISE AI",
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=16 * mm, bottomMargin=16 * mm,
    )

    base = getSampleStyleSheet()
    styles = {
        "title": ParagraphStyle("t", parent=base["Title"], fontSize=20, spaceAfter=2),
        "sub": ParagraphStyle("s", parent=base["Normal"], fontSize=9.5,
                              textColor=colors.HexColor("#64748b")),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontSize=12.5,
                             spaceBefore=12, spaceAfter=5,
                             textColor=colors.HexColor("#1e293b")),
        "body": ParagraphStyle("b", parent=base["Normal"], fontSize=9.5, leading=13.5),
        "small": ParagraphStyle("sm", parent=base["Normal"], fontSize=8,
                                leading=11, textColor=colors.HexColor("#64748b")),
        "banner": ParagraphStyle("ban", parent=base["Normal"], fontSize=9, leading=12,
                                 alignment=TA_CENTER,
                                 textColor=colors.HexColor("#92400e")),
    }

    line = colors.HexColor("#e2e8f0")
    story: list = []

    def _footer(canvas_obj, document):
        canvas_obj.saveState()
        canvas_obj.setFont("Helvetica", 7.5)
        canvas_obj.setFillColor(colors.HexColor("#94a3b8"))
        tag = "SAMPLE DATA  |  " if meta["is_sample_data"] else ""
        canvas_obj.drawString(18 * mm, 10 * mm,
                              f"{tag}FINWISE AI  |  {meta['month_label']}  |  "
                              f"educational project, not financial advice")
        canvas_obj.drawRightString(document.pagesize[0] - 18 * mm, 10 * mm,
                                   f"Page {canvas_obj.getPageNumber()}")
        canvas_obj.restoreState()


    def para(text, style):
        return Paragraph(_plain(text), style)

    def heading(text):
        story.append(para(text, styles["h2"]))

    def table(data, widths, *, align_right=(), header=True):
        # Sanitise plain string cells here rather than at every call site.
        # Cells that are already Paragraphs came through para() and are done.
        data = [[_plain(cell) if isinstance(cell, str) else cell for cell in row]
                for row in data]
        t = Table(data, colWidths=widths, hAlign="LEFT", repeatRows=1 if header else 0)
        style = [
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LINEBELOW", (0, 0), (-1, -2), 0.4, line),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]
        if header:
            style += [
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                ("LINEBELOW", (0, 0), (-1, 0), 0.8, colors.HexColor("#cbd5e1")),
            ]
        for column in align_right:
            style.append(("ALIGN", (column, 0), (column, -1), "RIGHT"))
        t.setStyle(TableStyle(style))
        story.append(t)

    # --- header ---------------------------------------------------------
    story.append(para("FINWISE AI", styles["title"]))
    story.append(para(
        f"Monthly financial report &mdash; <b>{meta['month_label']}</b>", styles["sub"]))
    story.append(para(
        f"Prepared for {meta.get('user_name') or meta.get('user_email') or 'you'} &middot; "
        f"generated {meta['generated_at'][:10]}", styles["sub"]))
    story.append(Spacer(1, 7))
    story.append(HRFlowable(width="100%", thickness=0.8, color=line))

    # The sample-data stamp goes at the top, before any figure is read, not in
    # a footnote someone can miss.
    if meta["is_sample_data"]:
        story.append(Spacer(1, 7))
        banner = Table(
            [[para(f"<b>SAMPLE DATA</b> &mdash; {meta['sample_notice']}", styles["banner"])]],
            colWidths=[doc.width], hAlign="LEFT",
        )
        banner.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fef3c7")),
            ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#f59e0b")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(banner)

    if meta["partial_month"]:
        story.append(Spacer(1, 6))
        story.append(para(
            f"<b>Note:</b> {meta['month_label']} is still in progress, so these are "
            f"month-to-date figures.", styles["small"]))

    if not report["has_data"]:
        story.append(Spacer(1, 14))
        story.append(para(
            f"No transactions were recorded in {meta['month_label']}.", styles["body"]))
        story.append(Spacer(1, 10))
        story.append(para(meta["disclaimer"], styles["small"]))
        doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
        return buffer.getvalue()

    # --- summary --------------------------------------------------------
    heading("Summary")
    previous = report.get("previous_totals")
    summary = [["", "This month", "Previous month", "Change"]]
    for label, key in [("Income", "income"), ("Expenses", "expense"), ("Savings", "savings")]:
        now = totals[key]
        before = previous[key] if previous else None
        change = f"{_rupees(now - before)}" if before is not None else "--"
        summary.append([label, _rupees(now),
                        _rupees(before) if before is not None else "--", change])
    rate = totals["savings_rate"]
    summary.append(["Savings rate",
                    f"{rate}%" if rate is not None else "--",
                    (f"{previous['savings_rate']}%"
                     if previous and previous["savings_rate"] is not None else "--"),
                    ""])
    summary.append(["Transactions", str(totals["transactions"]),
                    str(previous["transactions"]) if previous else "--", ""])
    table(summary, [45 * mm, 42 * mm, 42 * mm, 42 * mm], align_right=(1, 2, 3))

    # --- health ---------------------------------------------------------
    h = report["health"]
    heading("Financial health")
    story.append(para(
        f"<b>{h['score']} / 100 &mdash; {h['band']}</b>"
        + ("  (provisional: not enough recorded months yet)" if h["provisional"] else ""),
        styles["body"]))
    story.append(Spacer(1, 4))
    rubric = [["Component", "Score", "Weight", "Why"]]
    for component in h["components"]:
        rubric.append([
            component["label"],
            f"{component['points']:.1f}",
            str(component["max_points"]),
            para(component["explanation"], styles["small"]),
        ])
    table(rubric, [38 * mm, 16 * mm, 16 * mm, 101 * mm], align_right=(1, 2))
    story.append(Spacer(1, 4))
    story.append(para(h["disclaimer"], styles["small"]))

    # --- categories -----------------------------------------------------
    heading("Where the money went")
    categories = [["Category", "Amount", "Share", "Entries", "Average"]]
    for item in report["category_breakdown"]:
        categories.append([
            item["category"], _rupees(item["amount"]), f"{item['share']}%",
            str(item["transactions"]), _rupees(item["average"]),
        ])
    if len(categories) == 1:
        story.append(para("No expenses recorded this month.", styles["body"]))
    else:
        table(categories, [45 * mm, 33 * mm, 20 * mm, 25 * mm, 33 * mm],
              align_right=(1, 2, 3, 4))

    # --- comparison -----------------------------------------------------
    if report["comparison"]:
        heading(f"Compared with {analytics.month_label(report['previous_month'])}")
        if meta["partial_month"]:
            story.append(para(
                "Both months are truncated to the same elapsed day, so this is a "
                "like-for-like comparison rather than a part month against a whole one.",
                styles["small"]))
            story.append(Spacer(1, 4))
        comparison = [["Category", "This month", "Previous", "Change"]]
        for item in report["comparison"][:10]:
            pct = item["change_pct"]
            comparison.append([
                item["category"], _rupees(item["current"]), _rupees(item["previous"]),
                f"{_rupees(item['change'])}" + (f"  ({pct:+.1f}%)" if pct is not None else ""),
            ])
        table(comparison, [40 * mm, 33 * mm, 33 * mm, 48 * mm], align_right=(1, 2, 3))

    # --- budgets --------------------------------------------------------
    if report["budget_alerts"]:
        heading("Budgets")
        budget_rows = [["Budget", "Limit", "Spent", "Remaining", "Used"]]
        for alert in report["budget_alerts"]:
            budget_rows.append([
                alert["category"] or "Overall", _rupees(alert["budget"]),
                _rupees(alert["spent"]), _rupees(alert["remaining"]),
                f"{alert['used_pct']}%",
            ])
        table(budget_rows, [40 * mm, 30 * mm, 30 * mm, 30 * mm, 24 * mm],
              align_right=(1, 2, 3, 4))

    # --- anomalies ------------------------------------------------------
    anomalies = report["anomalies"]
    if anomalies["anomalies"]:
        heading("Spending to confirm")
        story.append(para(anomalies["note"], styles["small"]))
        story.append(Spacer(1, 4))
        rows_out = [["Date", "Description", "Amount", "Why it is flagged"]]
        for item in anomalies["anomalies"]:
            rows_out.append([
                item["date"], item["description"], _rupees(item["amount"]),
                para(item["reason"], styles["small"]),
            ])
        table(rows_out, [20 * mm, 40 * mm, 27 * mm, 84 * mm], align_right=(2,))

    # --- forecast and goals ---------------------------------------------
    forecast = report["forecast"]
    heading("Savings outlook")
    story.append(para(
        f"<b>Estimated next month: {_rupees(forecast['predicted_next'])}</b> "
        f"({forecast['method_label']}, {forecast['confidence']} confidence)", styles["body"]))
    story.append(Spacer(1, 3))
    story.append(para(forecast["explanation"], styles["small"]))

    if report["goals"]:
        story.append(Spacer(1, 6))
        goal_rows = [["Goal", "Remaining", "Estimated completion", "Status"]]
        for goal in report["goals"]:
            goal_rows.append([
                goal["name"], _rupees(goal["remaining"]),
                goal.get("eta_label") or "No estimate",
                goal["status"].replace("_", " ").title(),
            ])
        table(goal_rows, [50 * mm, 30 * mm, 40 * mm, 34 * mm], align_right=(1,))
        story.append(Spacer(1, 3))
        story.append(para(forecast["disclaimer"], styles["small"]))

    # --- insights -------------------------------------------------------
    if report["insights"]:
        heading("Insights")
        for insight in report["insights"]:
            # KeepTogether so a heading never ends a page with its body on the
            # next one.
            story.append(KeepTogether([
                para(f"<b>{insight['title']}</b><br/>{insight['body']}", styles["body"]),
                Spacer(1, 5),
            ]))

    # --- the transaction register ---------------------------------------
    # Conditional, not an unconditional PageBreak: when the preceding section
    # happened to end just past a page boundary, a hard break left a nearly
    # empty page between the two. This starts a new page only when there is
    # not enough room left to be worth starting the table here.
    story.append(CondPageBreak(70 * mm))
    heading(f"All transactions &mdash; {meta['month_label']}")
    register = [["Date", "Description", "Category", "Type", "Method", "Amount"]]
    for row in report["transactions"]:
        register.append([
            row["date"],
            para(str(row.get("description") or ""), styles["small"]),
            row.get("category") or "",
            (row.get("txn_type") or "").title(),
            row.get("payment_method") or "",
            _rupees(row.get("amount")),
        ])
    table(register, [19 * mm, 56 * mm, 25 * mm, 16 * mm, 24 * mm, 29 * mm], align_right=(5,))

    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=0.5, color=line))
    story.append(Spacer(1, 5))
    story.append(para(meta["disclaimer"], styles["small"]))

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buffer.getvalue()


def pdf_filename(month: str) -> str:
    return f"finwise-report-{month}.pdf"
