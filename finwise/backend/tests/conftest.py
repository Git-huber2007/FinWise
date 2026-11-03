"""Shared pytest fixtures.

Every test runs against a throwaway in-memory SQLite database, so tests never
touch finwise.db and never depend on each other's rows.
"""
import sys
from pathlib import Path

import pytest

# The backend package root, so `import app` works no matter where pytest runs.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import create_app  # noqa: E402
from config import Config  # noqa: E402
from models import User, db  # noqa: E402


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SECRET_KEY = "test-key"
    WTF_CSRF_ENABLED = False


@pytest.fixture
def app():
    application = create_app(TestConfig)
    with application.app_context():
        db.create_all()
        yield application
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def user(app):
    """A saved user with a known password."""
    u = User(email="asha@example.com", name="Asha Rao")
    u.set_password("correct-horse-battery")
    db.session.add(u)
    db.session.commit()
    return u


@pytest.fixture
def other_user(app):
    """A second user, for proving data isolation."""
    u = User(email="vikram@example.com", name="Vikram Shah")
    u.set_password("different-password")
    db.session.add(u)
    db.session.commit()
    return u
