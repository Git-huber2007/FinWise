"""Report assembly, CSV export and PDF rendering tests.

The PDF is tested for the things that can silently go wrong in a binary a
human has to open: that it is a real PDF, that it contains the figures it
claims to, and that a demo account's report is stamped as sample data. Pixel
layout is not asserted -- that is what the screenshot in the phase report is
for.
"""
import csv
import io

import pytest

import reporting
from tests.pdftext import pdf_text


def txn(date, amount, category, txn_type="expense", row_id=None, description=None):
    return {
        "id": row_id if row_id is not None else abs(hash((date, amount, category))) % 100000,
        "date": date, "amount": float(amount),
        "description": description or f"{category} spend",
        "category": category, "txn_type": txn_type, "payment_method": "UPI",
        "notes": None, "ai_category": None, "ai_confidence": None, "was_corrected": False,
    }


@pytest.fixture
def rows():
    """Sep and Oct 2026, hand-checkable.

    Oct: income 40,000; Food 8,000 + Shopping 4,000 + Transport 1,000 = 13,000;
         savings 27,000 (67.5%)
    """
    return [
        txn("2026-09-01", 40000, "Salary", "income", 1),
        txn("2026-09-05", 5000, "Food", row_id=2),
        txn("2026-09-12", 3000, "Shopping", row_id=3),
        txn("2026-09-20", 2000, "Transportation", row_id=4),
        txn("2026-10-01", 40000, "Salary", "income", 5),
        txn("2026-10-06", 8000, "Food", row_id=6),
        txn("2026-10-14", 4000, "Shopping", row_id=7),
        txn("2026-10-22", 1000, "Transportation", row_id=8),
    ]


USER = {"name": "Asha Rao", "email": "asha@example.com", "is_demo": False,
        "emergency_fund": 50000}
DEMO_USER = {**USER, "is_demo": True}


@pytest.fixture
def report(rows):
    return reporting.build_report(rows, budgets=[], goals=[], user=USER, month="2026-10")


# --------------------------------------------------------------------------
# Indian money formatting
# --------------------------------------------------------------------------

@pytest.mark.parametrize("value,expected", [
    (0, "Rs. 0.00"),
    (999, "Rs. 999.00"),
    (1000, "Rs. 1,000.00"),
    (52000, "Rs. 52,000.00"),
    (100000, "Rs. 1,00,000.00"),          # one lakh, not 100,000
    (1234567, "Rs. 12,34,567.00"),        # twelve lakh thirty-four thousand
    (10000000, "Rs. 1,00,00,000.00"),     # one crore
    (-2500.5, "-Rs. 2,500.50"),
    (349.5, "Rs. 349.50"),                # paise are never rounded away
])
def test_indian_digit_grouping(value, expected):
    assert reporting._rupees(value) == expected


def test_money_formatting_survives_junk():
    assert reporting._rupees(None) == "Rs. 0.00"
    assert reporting._rupees("not a number") == "Rs. 0.00"


def test_the_pdf_never_emits_the_rupee_glyph():
    """Helvetica has no U+20B9 and reportlab ships no font that does.

    If someone swaps _rupees back to the symbol, the PDF renders boxes. This
    test is the tripwire.
    """
    assert "₹" not in reporting._rupees(52000)


# --------------------------------------------------------------------------
# build_report
# --------------------------------------------------------------------------

def test_report_totals_match_the_hand_computed_figures(report):
    assert report["totals"]["income"] == 40000.0
    assert report["totals"]["expense"] == 13000.0
    assert report["totals"]["savings"] == 27000.0
    assert report["totals"]["savings_rate"] == 67.5
    assert report["totals"]["transactions"] == 4


def test_report_carries_the_previous_month_for_comparison(report):
    assert report["previous_month"] == "2026-09"
    assert report["previous_totals"]["expense"] == 10000.0
    assert report["comparison"], "a month with a predecessor must have a comparison"


def test_report_contains_only_the_requested_month(report):
    assert len(report["transactions"]) == 4
    assert all(row["date"].startswith("2026-10") for row in report["transactions"])


def test_transactions_are_ordered_oldest_first(report):
    dates = [row["date"] for row in report["transactions"]]
    assert dates == sorted(dates)


def test_report_agrees_with_the_dashboard_modules(rows, report):
    """The report must not recompute anything the screen already computes."""
    from ai import analytics
    month_rows = analytics.filter_month(rows, "2026-10")
    assert report["totals"] == analytics.totals_for(month_rows)
    assert report["category_breakdown"] == analytics.category_breakdown(month_rows)


def test_a_month_with_no_transactions_is_handled(rows):
    empty = reporting.build_report(rows, budgets=[], goals=[], user=USER, month="2026-01")
    assert empty["has_data"] is False
    assert empty["transactions"] == []
    assert empty["totals"]["income"] == 0


def test_every_report_carries_its_disclaimers(report):
    meta = report["meta"]
    assert "not a credit score" in meta["disclaimer"]
    assert "estimates" in meta["disclaimer"]
    assert report["health"]["disclaimer"]
    assert report["forecast"]["disclaimer"]


def test_a_demo_account_report_is_marked_as_sample_data(rows):
    demo = reporting.build_report(rows, budgets=[], goals=[], user=DEMO_USER, month="2026-10")
    real = reporting.build_report(rows, budgets=[], goals=[], user=USER, month="2026-10")
    assert demo["meta"]["is_sample_data"] is True
    assert "demonstration data" in demo["meta"]["sample_notice"]
    assert real["meta"]["is_sample_data"] is False
    assert real["meta"]["sample_notice"] is None


# --------------------------------------------------------------------------
# CSV
# --------------------------------------------------------------------------

def test_csv_has_a_header_and_one_row_per_transaction(rows):
    body = reporting.render_csv(rows)
    parsed = list(csv.DictReader(io.StringIO(body)))
    assert len(parsed) == len(rows)
    assert list(parsed[0].keys()) == reporting.CSV_COLUMNS


def test_csv_has_no_blank_rows_between_records(rows):
    """csv defaults to \\r\\n, which Flask turns into a blank line per record."""
    body = reporting.render_csv(rows)
    assert "\r" not in body
    assert "\n\n" not in body


def test_csv_values_round_trip(rows):
    parsed = list(csv.DictReader(io.StringIO(reporting.render_csv(rows))))
    first = parsed[0]
    assert first["date"] == "2026-09-01"
    assert float(first["amount"]) == 40000.0
    assert first["txn_type"] == "income"


def test_csv_escapes_a_description_containing_a_comma_and_quotes():
    """The classic CSV corruption: an unescaped separator shifts every column."""
    nasty = txn("2026-10-01", 500, "Food",
                description='Dinner, "the good place", 2 people')
    parsed = list(csv.DictReader(io.StringIO(reporting.render_csv([nasty]))))
    assert len(parsed) == 1
    assert parsed[0]["description"] == 'Dinner, "the good place", 2 people'
    assert float(parsed[0]["amount"]) == 500.0


def test_csv_of_nothing_is_still_a_valid_file_with_headers():
    body = reporting.render_csv([])
    assert body.strip() == ",".join(reporting.CSV_COLUMNS)


# --------------------------------------------------------------------------
# PDF
# --------------------------------------------------------------------------

def test_pdf_is_a_real_pdf(report):
    pdf = reporting.render_pdf(report)
    assert pdf.startswith(b"%PDF-"), "not a PDF at all"
    assert pdf.rstrip().endswith(b"%%EOF"), "truncated PDF"
    assert len(pdf) > 3000


def test_pdf_renders_for_a_month_with_no_transactions(rows):
    """The empty-month branch is a separate code path and has its own footer."""
    empty = reporting.build_report(rows, budgets=[], goals=[], user=USER, month="2026-01")
    pdf = reporting.render_pdf(empty)
    assert pdf.startswith(b"%PDF-")
    assert len(pdf) > 1000


def test_pdf_builds_with_budgets_goals_and_anomalies(rows):
    """Every optional section at once -- each is a branch that can throw."""
    rows = rows + [txn("2026-10-28", 52000, "Shopping", row_id=99,
                       description="Laptop purchase")]
    budgets = [{"id": 1, "category": None, "amount": 20000, "month": 10, "year": 2026},
               {"id": 2, "category": "Food", "amount": 6000, "month": 10, "year": 2026}]
    goals = [{"id": 1, "name": "Laptop", "remaining": 20000, "target_amount": 60000,
              "saved_amount": 40000, "target_date": "2027-06-01", "status": "active"}]
    report = reporting.build_report(rows, budgets=budgets, goals=goals,
                                    user=USER, month="2026-10")
    assert report["budget_alerts"], "budgets for the reported month must produce alerts"
    assert report["goals"], "an active goal must be projected"
    pdf = reporting.render_pdf(report)
    assert pdf.startswith(b"%PDF-")


def test_demo_pdf_is_visibly_stamped(rows):
    """A reader must not be able to mistake seeded figures for real records."""
    demo = reporting.build_report(rows, budgets=[], goals=[], user=DEMO_USER, month="2026-10")
    text = pdf_text(reporting.render_pdf(demo))
    assert "SAMPLE DATA" in text


def test_a_real_account_pdf_is_not_stamped(report):
    assert "SAMPLE DATA" not in pdf_text(reporting.render_pdf(report))


def test_pdf_contains_the_figures_it_reports(report):
    """The point of the PDF: the numbers on the page are the real ones."""
    text = pdf_text(reporting.render_pdf(report))
    assert "FINWISE AI" in text
    assert "Oct 2026" in text
    assert "40,000.00" in text, "income missing from the PDF"
    assert "13,000.00" in text, "expenses missing from the PDF"
    assert "27,000.00" in text, "savings missing from the PDF"
    assert "67.5%" in text, "savings rate missing from the PDF"
    # The register must list every transaction, not just a summary.
    for row in report["transactions"]:
        assert row["description"] in text


def test_pdf_states_it_is_not_financial_advice(report):
    text = pdf_text(reporting.render_pdf(report))
    assert "not financial advice" in text
    assert "educational project" in text


def test_pdf_filenames_name_the_month(report):
    assert reporting.pdf_filename("2026-10") == "finwise-report-2026-10.pdf"
    assert reporting.csv_filename().startswith("finwise-transactions-")
    assert reporting.csv_filename().endswith(".csv")


# --------------------------------------------------------------------------
# Text that reaches the PDF from elsewhere
# --------------------------------------------------------------------------

def test_plain_strips_the_rupee_sign_from_engine_prose():
    assert reporting._plain("spending varies around \u20b952,335") == (
        "spending varies around Rs. 52,335"
    )


def test_plain_leaves_ordinary_text_alone():
    assert reporting._plain("Budget management") == "Budget management"
    assert reporting._plain("Compared with Sep 2026") == "Compared with Sep 2026"


def test_health_explanations_reach_the_pdf_in_readable_form(report):
    """The first build of this PDF printed black boxes.

    The health explanations, generated insights and anomaly reasons are written
    by the ai/* modules, which use the real rupee sign because they also feed
    the web UI. Only the figures this module formats itself were safe;
    everything borrowed was not, and the PDF read
    "spending varies around [box]52,335".

    Note what is NOT asserted: reportlab does not raise, and does not insert a
    replacement character, for a glyph the font lacks. It writes a byte that
    extracts as "n" and that a viewer draws as a filled box. So a test for
    U+FFFD passes whether or not the bug is present -- it was written first,
    passed against the broken code, and was deleted for it. Asserting that the
    figures arrive intact is the version that can actually fail.
    """
    import re

    source = " ".join(c["explanation"] for c in report["health"]["components"])
    assert "\u20b9" in source, "fixture assumes health prose contains the symbol"

    text = pdf_text(reporting.render_pdf(report))
    assert "\u20b9" not in text

    for figure in re.findall(r"\u20b9([\d,]+)", source):
        assert f"Rs. {figure}" in text, f"{figure} lost or mangled on the way into the PDF"
        assert f"n{figure}" not in text, f"{figure} rendered as a box glyph"
