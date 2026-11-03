"""Request validation.

One module so that every endpoint rejects bad input the same way and returns
the same error shape: {"error": "...", "field": "..."} with status 400.

Each helper either returns a clean, correctly-typed value or raises
ValidationError. Nothing half-validated reaches the ORM.
"""
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from flask import jsonify

from constants import CATEGORIES, PAYMENT_METHODS, TXN_TYPES

# Guards against a Numeric(12,2) overflow and absurd input alike.
MAX_AMOUNT = Decimal("99999999.99")


class ValidationError(Exception):
    def __init__(self, message: str, field: str | None = None):
        super().__init__(message)
        self.message = message
        self.field = field

    def response(self):
        return jsonify(error=self.message, field=self.field), 400


def register_validation_handler(app):
    @app.errorhandler(ValidationError)
    def _handle(err: ValidationError):
        return err.response()


def require_json(request) -> dict:
    """Flask's get_json() raises a 415 on a bad content type; we want a 400."""
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ValidationError("Request body must be a JSON object.")
    return data


def text(data: dict, key: str, *, required=True, max_len=255, default=None) -> str | None:
    raw = data.get(key, default)
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        if required:
            raise ValidationError(f"{key.replace('_', ' ').capitalize()} is required.", key)
        return default
    if not isinstance(raw, str):
        raise ValidationError(f"{key} must be text.", key)
    value = raw.strip()
    if len(value) > max_len:
        raise ValidationError(f"{key} must be {max_len} characters or fewer.", key)
    return value


def email(data: dict, key: str = "email") -> str:
    value = text(data, key, max_len=255)
    # Deliberately permissive: the only reliable email validation is sending a
    # message to it. This catches typos, not every RFC violation.
    local, _, domain = value.partition("@")
    if not local or not domain or "." not in domain or " " in value:
        raise ValidationError("Enter a valid email address.", key)
    return value.lower()


def password(data: dict, key: str = "password", *, min_len=8) -> str:
    raw = data.get(key)
    if not isinstance(raw, str) or not raw:
        raise ValidationError("Password is required.", key)
    if len(raw) < min_len:
        raise ValidationError(f"Password must be at least {min_len} characters.", key)
    if len(raw) > 200:
        # Long inputs are a cheap DoS against a deliberately slow hash.
        raise ValidationError("Password must be 200 characters or fewer.", key)
    return raw


def amount(data: dict, key: str = "amount", *, required=True) -> Decimal | None:
    raw = data.get(key)
    if raw is None or raw == "":
        if required:
            raise ValidationError("Amount is required.", key)
        return None
    try:
        # str() first: Decimal(float) inherits the float's representation error.
        value = Decimal(str(raw)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError, TypeError):
        raise ValidationError("Amount must be a number.", key)
    if value <= 0:
        raise ValidationError("Amount must be greater than zero.", key)
    if value > MAX_AMOUNT:
        raise ValidationError(f"Amount must be at most {MAX_AMOUNT}.", key)
    return value


def money_or_none(data: dict, key: str) -> Decimal | None:
    """For optional, non-negative figures such as monthly income."""
    raw = data.get(key)
    if raw is None or raw == "":
        return None
    try:
        value = Decimal(str(raw)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError, TypeError):
        raise ValidationError(f"{key.replace('_', ' ').capitalize()} must be a number.", key)
    if value < 0:
        raise ValidationError(f"{key.replace('_', ' ').capitalize()} cannot be negative.", key)
    if value > MAX_AMOUNT:
        raise ValidationError(f"{key} is too large.", key)
    return value


def iso_date(data: dict, key: str = "date", *, required=True, default_today=False) -> date | None:
    raw = data.get(key)
    if not raw:
        if default_today:
            return date.today()
        if required:
            raise ValidationError("Date is required.", key)
        return None
    if isinstance(raw, date):
        return raw
    try:
        parsed = datetime.strptime(str(raw)[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        raise ValidationError("Date must be in YYYY-MM-DD format.", key)
    # A transaction dated 50 years out is a typo, not a plan.
    if parsed.year < 1970 or parsed.year > date.today().year + 50:
        raise ValidationError("Date is out of range.", key)
    return parsed


def choice(data: dict, key: str, options, *, required=True, default=None) -> str | None:
    raw = data.get(key, default)
    if raw is None or raw == "":
        if required:
            raise ValidationError(f"{key.replace('_', ' ').capitalize()} is required.", key)
        return default
    value = str(raw).strip()
    if value not in options:
        raise ValidationError(
            f"{key.replace('_', ' ').capitalize()} must be one of: {', '.join(options)}.", key
        )
    return value


def category(data: dict, key: str = "category", **kwargs) -> str | None:
    return choice(data, key, CATEGORIES, **kwargs)


def txn_type(data: dict, key: str = "txn_type", **kwargs) -> str | None:
    return choice(data, key, TXN_TYPES, **kwargs)


def payment_method(data: dict, key: str = "payment_method", **kwargs) -> str | None:
    return choice(data, key, PAYMENT_METHODS, required=False, **kwargs)


def integer(data: dict, key: str, *, minimum=None, maximum=None, required=True, default=None):
    raw = data.get(key, default)
    if raw is None or raw == "":
        if required:
            raise ValidationError(f"{key} is required.", key)
        return default
    try:
        value = int(raw)
    except (ValueError, TypeError):
        raise ValidationError(f"{key} must be a whole number.", key)
    if minimum is not None and value < minimum:
        raise ValidationError(f"{key} must be at least {minimum}.", key)
    if maximum is not None and value > maximum:
        raise ValidationError(f"{key} must be at most {maximum}.", key)
    return value
