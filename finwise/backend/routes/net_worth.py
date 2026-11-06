"""Net Worth, Asset, and Liability portfolio tracking.

Computes net worth (Assets - Liabilities), asset allocation breakdown,
and liquid reserves for emergency planning.
"""
from datetime import datetime, timezone
from decimal import Decimal
from typing import cast

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import select
from werkzeug.exceptions import NotFound

import validation as v
from models import Asset, Debt, User, db

bp = Blueprint("net_worth", __name__, url_prefix="/api/net-worth")

ASSET_TYPES = ["cash", "bank", "investment", "retirement", "gold", "property", "other"]


def _me() -> User:
    return cast(User, current_user)


def _owned_asset_or_404(asset_id: int) -> Asset:
    asset = db.session.scalar(
        select(Asset).where(Asset.id == asset_id, Asset.user_id == _me().id)
    )
    if asset is None:
        raise NotFound("Asset not found.")
    return asset


@bp.route("", methods=["GET"])
@login_required
def get_net_worth():
    user = _me()
    assets = db.session.scalars(
        select(Asset).where(Asset.user_id == user.id).order_by(Asset.balance.desc())
    ).all()
    debts = db.session.scalars(
        select(Debt).where(Debt.user_id == user.id).order_by(Debt.current_balance.desc())
    ).all()

    total_assets = sum((a.balance for a in assets), Decimal("0"))
    total_liabilities = sum((d.current_balance for d in debts), Decimal("0"))
    net_worth = total_assets - total_liabilities

    # Liquid assets: cash and bank accounts
    liquid_assets = sum(
        (a.balance for a in assets if a.asset_type in ("cash", "bank")), Decimal("0")
    )
    # If user has self-reported emergency fund and no liquid assets recorded, fallback
    if liquid_assets == 0 and user.emergency_fund:
        liquid_assets = user.emergency_fund

    # Asset allocation breakdown
    asset_breakdown = []
    if total_assets > 0:
        by_type: dict[str, Decimal] = {}
        for a in assets:
            by_type[a.asset_type] = by_type.get(a.asset_type, Decimal("0")) + a.balance
        for atype, bal in sorted(by_type.items(), key=lambda x: x[1], reverse=True):
            asset_breakdown.append({
                "type": atype,
                "amount": float(bal),
                "share_pct": round(float(bal / total_assets) * 100, 1),
            })

    # Liability breakdown
    debt_breakdown = []
    if total_liabilities > 0:
        by_type_debt: dict[str, Decimal] = {}
        for d in debts:
            by_type_debt[d.debt_type] = by_type_debt.get(d.debt_type, Decimal("0")) + d.current_balance
        for dtype, bal in sorted(by_type_debt.items(), key=lambda x: x[1], reverse=True):
            debt_breakdown.append({
                "type": dtype,
                "amount": float(bal),
                "share_pct": round(float(bal / total_liabilities) * 100, 1),
            })

    return jsonify({
        "summary": {
            "total_assets": float(total_assets),
            "total_liabilities": float(total_liabilities),
            "net_worth": float(net_worth),
            "liquid_assets": float(liquid_assets),
            "debt_to_asset_ratio": round(float(total_liabilities / total_assets * 100), 1) if total_assets > 0 else 0.0,
            "asset_count": len(assets),
            "debt_count": len(debts),
        },
        "assets": [a.to_dict() for a in assets],
        "debts": [d.to_dict() for d in debts],
        "asset_allocation": asset_breakdown,
        "debt_allocation": debt_breakdown,
    })


@bp.route("/assets", methods=["POST"])
@login_required
def create_asset():
    data = v.require_json(request)
    asset = Asset(
        user_id=_me().id,
        name=v.text(data, "name", max_len=120),
        asset_type=v.choice(data, "asset_type", ASSET_TYPES, default="bank"),
        balance=v.amount(data, "balance", required=True),
        institution=v.text(data, "institution", required=False, max_len=80),
        notes=v.text(data, "notes", required=False, max_len=500),
    )
    db.session.add(asset)
    db.session.commit()
    return jsonify(asset.to_dict()), 201


@bp.route("/assets/<int:asset_id>", methods=["PUT"])
@login_required
def update_asset(asset_id: int):
    asset = _owned_asset_or_404(asset_id)
    data = v.require_json(request)

    if "name" in data:
        asset.name = v.text(data, "name", max_len=120)
    if "asset_type" in data:
        asset.asset_type = v.choice(data, "asset_type", ASSET_TYPES, default="bank")
    if "balance" in data:
        asset.balance = v.amount(data, "balance", required=True)
    if "institution" in data:
        asset.institution = v.text(data, "institution", required=False, max_len=80)
    if "notes" in data:
        asset.notes = v.text(data, "notes", required=False, max_len=500)
    asset.updated_at = datetime.now(timezone.utc)

    db.session.commit()
    return jsonify(asset.to_dict())


@bp.route("/assets/<int:asset_id>", methods=["DELETE"])
@login_required
def delete_asset(asset_id: int):
    asset = _owned_asset_or_404(asset_id)
    db.session.delete(asset)
    db.session.commit()
    return jsonify({"success": True})

