"""Tax Regime Estimator (Old vs. New Tax Regime - India).

Computes exact income tax liabilities, slab breakdowns, section deductions
(80C, 80D, standard deduction, 24b home loan interest), 87A rebates,
and 4% health & education cess.
"""
from decimal import Decimal
from typing import cast

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import func, select

from models import Transaction, User, db

bp = Blueprint("tax", __name__, url_prefix="/api/tax")


def _me() -> User:
    return cast(User, current_user)


def _compute_new_regime(gross_income: float) -> dict:
    """Compute tax under New Tax Regime (Section 115BAC, FY 2024-25/2025-26 rules)."""
    std_deduction = 75000.0
    taxable_income = max(0.0, gross_income - std_deduction)

    slabs = [
        {"min": 0, "max": 300000, "rate": 0.0, "label": "₹0 - ₹3,00,000 (Nil)"},
        {"min": 300000, "max": 700000, "rate": 0.05, "label": "₹3,00,001 - ₹7,00,000 (5%)"},
        {"min": 700000, "max": 1000000, "rate": 0.10, "label": "₹7,00,001 - ₹10,00,000 (10%)"},
        {"min": 1000000, "max": 1200000, "rate": 0.15, "label": "₹10,00,001 - ₹12,00,000 (15%)"},
        {"min": 1200000, "max": 1500000, "rate": 0.20, "label": "₹12,00,001 - ₹15,00,000 (20%)"},
        {"min": 1500000, "max": float("inf"), "rate": 0.30, "label": "Above ₹15,00,000 (30%)"},
    ]

    base_tax = 0.0
    slab_breakdown = []

    remaining = taxable_income
    for s in slabs:
        span = s["max"] - s["min"]
        if remaining > 0:
            taxed_amount = min(remaining, span)
            slab_tax = taxed_amount * s["rate"]
            base_tax += slab_tax
            slab_breakdown.append({
                "slab": s["label"],
                "taxable_in_slab": round(taxed_amount, 2),
                "rate_pct": int(s["rate"] * 100),
                "tax": round(slab_tax, 2),
            })
            remaining -= taxed_amount
        else:
            slab_breakdown.append({
                "slab": s["label"],
                "taxable_in_slab": 0.0,
                "rate_pct": int(s["rate"] * 100),
                "tax": 0.0,
            })

    # Section 87A Rebate: If taxable income <= 7,00,000, rebate up to 25,000 (tax becomes 0)
    rebate_87a = 0.0
    if taxable_income <= 700000.0:
        rebate_87a = base_tax
        tax_after_rebate = 0.0
    else:
        # Marginal relief for taxable income slightly above 7 lakhs
        marginal_excess = taxable_income - 700000.0
        if base_tax > marginal_excess:
            rebate_87a = base_tax - marginal_excess
            tax_after_rebate = marginal_excess
        else:
            tax_after_rebate = base_tax

    cess = round(tax_after_rebate * 0.04, 2)
    total_tax = round(tax_after_rebate + cess, 2)

    return {
        "regime": "New Regime (Section 115BAC)",
        "gross_income": round(gross_income, 2),
        "standard_deduction": std_deduction,
        "other_deductions": 0.0,
        "total_deductions": std_deduction,
        "taxable_income": round(taxable_income, 2),
        "base_tax": round(base_tax, 2),
        "rebate_87a": round(rebate_87a, 2),
        "cess_4pct": cess,
        "total_tax": total_tax,
        "effective_tax_rate": round(total_tax / gross_income * 100, 2) if gross_income > 0 else 0.0,
        "slab_breakdown": slab_breakdown,
    }


def _compute_old_regime(gross_income: float, sec_80c: float = 150000.0,
                        sec_80d: float = 25000.0, sec_24b: float = 0.0,
                        other_deductions: float = 0.0) -> dict:
    """Compute tax under Old Tax Regime with itemized Chapter VI-A deductions."""
    std_deduction = 50000.0
    # 80C capped at 1.5 lakhs
    ded_80c = min(150000.0, max(0.0, sec_80c))
    # 80D health insurance (capped at 1 lakh)
    ded_80d = min(100000.0, max(0.0, sec_80d))
    # 24b home loan interest capped at 2 lakhs
    ded_24b = min(200000.0, max(0.0, sec_24b))
    total_deductions = std_deduction + ded_80c + ded_80d + ded_24b + max(0.0, other_deductions)

    taxable_income = max(0.0, gross_income - total_deductions)

    slabs = [
        {"min": 0, "max": 250000, "rate": 0.0, "label": "₹0 - ₹2,50,000 (Nil)"},
        {"min": 250000, "max": 500000, "rate": 0.05, "label": "₹2,50,001 - ₹5,00,000 (5%)"},
        {"min": 500000, "max": 1000000, "rate": 0.20, "label": "₹5,00,001 - ₹10,00,000 (20%)"},
        {"min": 1000000, "max": float("inf"), "rate": 0.30, "label": "Above ₹10,00,000 (30%)"},
    ]

    base_tax = 0.0
    slab_breakdown = []

    remaining = taxable_income
    for s in slabs:
        span = s["max"] - s["min"]
        if remaining > 0:
            taxed_amount = min(remaining, span)
            slab_tax = taxed_amount * s["rate"]
            base_tax += slab_tax
            slab_breakdown.append({
                "slab": s["label"],
                "taxable_in_slab": round(taxed_amount, 2),
                "rate_pct": int(s["rate"] * 100),
                "tax": round(slab_tax, 2),
            })
            remaining -= taxed_amount
        else:
            slab_breakdown.append({
                "slab": s["label"],
                "taxable_in_slab": 0.0,
                "rate_pct": int(s["rate"] * 100),
                "tax": 0.0,
            })

    # Section 87A Rebate in Old Regime: If taxable income <= 5,00,000, rebate up to 12,500
    rebate_87a = 0.0
    if taxable_income <= 500000.0:
        rebate_87a = base_tax
        tax_after_rebate = 0.0
    else:
        tax_after_rebate = base_tax

    cess = round(tax_after_rebate * 0.04, 2)
    total_tax = round(tax_after_rebate + cess, 2)

    return {
        "regime": "Old Regime (With Exemptions)",
        "gross_income": round(gross_income, 2),
        "standard_deduction": std_deduction,
        "deductions_itemized": {
            "section_80c": ded_80c,
            "section_80d": ded_80d,
            "section_24b_home_loan": ded_24b,
            "other": round(other_deductions, 2),
        },
        "total_deductions": round(total_deductions, 2),
        "taxable_income": round(taxable_income, 2),
        "base_tax": round(base_tax, 2),
        "rebate_87a": round(rebate_87a, 2),
        "cess_4pct": cess,
        "total_tax": total_tax,
        "effective_tax_rate": round(total_tax / gross_income * 100, 2) if gross_income > 0 else 0.0,
        "slab_breakdown": slab_breakdown,
    }


@bp.route("/estimate", methods=["GET"])
@login_required
def get_tax_estimate():
    user = _me()

    # Derived annual income: from self-reported monthly_income or annualised Salary txns
    annual_income = 0.0
    if user.monthly_income:
        annual_income = float(user.monthly_income) * 12.0
    else:
        # Check sum of salary income
        sal = db.session.scalar(
            select(func.sum(Transaction.amount)).where(
                Transaction.user_id == user.id,
                Transaction.category == "Salary",
                Transaction.txn_type == "income",
            )
        )
        annual_income = float(sal) if sal else 750000.0

    # Query param overrides
    gross = float(request.args.get("gross_income", annual_income))
    sec_80c = float(request.args.get("sec_80c", 150000.0))
    sec_80d = float(request.args.get("sec_80d", 25000.0))
    sec_24b = float(request.args.get("sec_24b", 0.0))

    new_res = _compute_new_regime(gross)
    old_res = _compute_old_regime(gross, sec_80c, sec_80d, sec_24b)

    diff = round(abs(new_res["total_tax"] - old_res["total_tax"]), 2)
    if new_res["total_tax"] < old_res["total_tax"]:
        recommendation = {
            "preferred": "new",
            "preferred_label": "New Tax Regime",
            "tax_saved": diff,
            "summary": f"The New Regime saves you ₹{diff:,.0f} in annual taxes thanks to lower tax slab rates and the ₹75,000 standard deduction.",
        }
    elif old_res["total_tax"] < new_res["total_tax"]:
        recommendation = {
            "preferred": "old",
            "preferred_label": "Old Tax Regime",
            "tax_saved": diff,
            "summary": f"The Old Regime saves you ₹{diff:,.0f} in annual taxes due to your high deductions (₹{old_res['total_deductions']:,.0f}).",
        }
    else:
        recommendation = {
            "preferred": "equal",
            "preferred_label": "Either Regime",
            "tax_saved": 0.0,
            "summary": "Both tax regimes yield the exact same tax liability for your current income profile.",
        }

    return jsonify({
        "gross_income": gross,
        "recommendation": recommendation,
        "new_regime": new_res,
        "old_regime": old_res,
    })

