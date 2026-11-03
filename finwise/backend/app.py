"""Flask application factory.

Everything the API needs is assembled here: config, ORM, the login manager and
the route blueprints. Blueprints are registered as the phases add them.
"""
import os

from flask import Flask, jsonify, request
from flask_login import LoginManager
from sqlalchemy import event, inspect as sa_inspect
from sqlalchemy.engine import Engine

from config import Config
from constants import CATEGORIES, PAYMENT_METHODS, TXN_TYPES
from models import User, db

login_manager = LoginManager()


@event.listens_for(Engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection, _record):
    """SQLite ignores FOREIGN KEY constraints unless asked, per connection.

    Without this the ondelete="CASCADE" clauses are decorative and an orphaned
    transaction row can outlive its user. Guarded by a module check so the same
    listener is harmless if the database is ever swapped for Postgres.
    """
    if type(dbapi_connection).__module__.startswith("sqlite3"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


@login_manager.user_loader
def load_user(user_id: str):
    return db.session.get(User, int(user_id))


@login_manager.unauthorized_handler
def unauthorized():
    """This is an API, not a server-rendered app.

    Flask-Login's default is a 302 to a login page, which a fetch() caller sees
    as a confusing opaque redirect. A JSON 401 is what the frontend can act on.
    """
    return jsonify(error="authentication required"), 401


def create_app(config_object=Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_object)

    db.init_app(app)
    login_manager.init_app(app)

    loaded, missing = _register_blueprints(app)
    _register_error_handlers(app)

    with app.app_context():
        # Idempotent: create_all only creates what is missing. A single-file
        # SQLite database with no deployed history has nothing to migrate, so a
        # migration tool here would be ceremony with no payoff.
        db.create_all()

    @app.get("/api/health")
    def health():
        """Liveness plus enough introspection to verify a fresh install."""
        with app.app_context():
            tables = sorted(sa_inspect(db.engine).get_table_names())
        return jsonify(
            status="ok",
            service="finwise-api",
            version="1.0.0",
            database={
                "dialect": db.engine.dialect.name,
                "tables": tables,
            },
            # Advertises whether the LLM path is available WITHOUT leaking the
            # key or any part of it.
            llm_configured=bool(app.config["GEMINI_API_KEY"]),
            # Route modules are loaded opportunistically so that a phase which
            # has not been built yet does not stop the app. Reporting both lists
            # is what keeps that from hiding a module that failed to import.
            blueprints={"loaded": loaded, "missing": missing},
        )

    @app.get("/api/meta")
    def meta():
        """Vocabulary the frontend needs for dropdowns, served from one place.

        Hardcoding these lists in React would let them drift from what the API
        validates against.
        """
        return jsonify(categories=CATEGORIES, txn_types=TXN_TYPES,
                       payment_methods=PAYMENT_METHODS)

    for warning in config_object.warnings():
        app.logger.warning("config: %s", warning)

    return app


ROUTE_MODULES = ["auth", "transactions", "dashboard", "budgets", "goals", "ai", "reports"]


def _register_blueprints(app: Flask) -> tuple[list[str], list[str]]:
    """Register whichever route modules exist, and report what was found.

    Imported inside the function so the import graph has no cycle back to
    app.py. A module that a later phase has not written yet is skipped rather
    than crashing the app -- but ONLY when it is genuinely absent. An
    ImportError from inside a module that does exist is re-raised, because
    swallowing that would turn a real bug into a silently missing API.
    """
    loaded, missing = [], []
    for name in ROUTE_MODULES:
        dotted = f"routes.{name}"
        try:
            module = __import__(dotted, fromlist=["bp"])
        except ModuleNotFoundError as exc:
            if exc.name != dotted:
                raise  # the module exists but one of ITS imports is broken
            missing.append(name)
            continue
        app.register_blueprint(module.bp)
        loaded.append(name)
    return loaded, missing


def _register_error_handlers(app: Flask) -> None:
    @app.errorhandler(400)
    def bad_request(err):
        return jsonify(error=getattr(err, "description", "bad request")), 400

    @app.errorhandler(404)
    def not_found(err):
        return jsonify(error="not found", path=request.path), 404

    @app.errorhandler(405)
    def not_allowed(err):
        return jsonify(error="method not allowed", method=request.method), 405

    @app.errorhandler(500)
    def server_error(err):
        # Log the real exception, return a generic message: internal details
        # must not leak to the client.
        app.logger.exception("unhandled error on %s", request.path)
        db.session.rollback()
        return jsonify(error="internal server error"), 500


if __name__ == "__main__":
    application = create_app()
    for note in Config.warnings():
        print(f"[config] {note}")
    port = int(os.environ.get("PORT", 5000))
    print(f"[finwise] API on http://localhost:{port}")
    application.run(debug=True, port=port)
