"""Environment-driven configuration.

This is the only module that reads os.environ. Secrets are never defaulted to a
real value and never logged.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def _bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, "1" if default else "0").strip().lower() in ("1", "true", "yes", "on")


class Config:
    # ---- security -------------------------------------------------------
    # A missing SECRET_KEY in production would silently reset every session on
    # restart, so development gets a loud, obviously-fake placeholder instead of
    # a random one (a random default makes sessions die on every reload).
    SECRET_KEY = os.environ.get("SECRET_KEY") or "dev-only-insecure-key-change-me"

    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = _bool("SESSION_COOKIE_SECURE", False)
    PERMANENT_SESSION_LIFETIME = 60 * 60 * 24 * 7  # one week

    # ---- database -------------------------------------------------------
    _db_url = os.environ.get("DATABASE_URL")
    if _db_url and _db_url.startswith("postgres://"):
        _db_url = _db_url.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_DATABASE_URI = _db_url or f"sqlite:///{BASE_DIR / 'finwise.db'}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # ---- optional LLM ---------------------------------------------------
    # Read server-side only. Never serialised into any HTTP response.
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
    GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash").strip()

    # ---- cors -----------------------------------------------------------
    # NOT "*": with supports_credentials, Flask-CORS reflects whatever Origin
    # it is sent, so a wildcard default lets any site make credentialed calls.
    # Frontend and API are same-origin (Vite proxy in dev, Vercel rewrite in
    # prod), so cross-origin access is opt-in via CORS_ORIGINS.
    CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]

    JSON_SORT_KEYS = False

    @classmethod
    def warnings(cls) -> list[str]:
        """Config problems worth printing at startup. Never prints values."""
        out = []
        if cls.SECRET_KEY == "dev-only-insecure-key-change-me":
            out.append("SECRET_KEY is the development placeholder - set it in .env before any real use")
        if not cls.GEMINI_API_KEY:
            out.append("GEMINI_API_KEY not set - AI Assistant will use the rule-based fallback engine")
        return out
