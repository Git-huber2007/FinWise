# FINWISE AI — Architecture

## 1. What this system is

A three-tier personal finance platform. A React single-page app talks to a Flask
REST API, which owns a SQLite database and a set of pure Python AI/ML modules.
Nothing is mocked: every number on screen is computed from rows in the database.

## 2. Tiers

```
┌──────────────────────────────────────────────────────────┐
│  BROWSER  —  React 18 SPA (Vite dev server :5173)        │
│  react-router · Recharts · Tailwind · lucide-react       │
└───────────────────────┬──────────────────────────────────┘
                        │  fetch('/api/...', credentials:'include')
                        │  Vite dev-proxy rewrites to :5000
                        ▼
┌──────────────────────────────────────────────────────────┐
│  API  —  Flask 3 (:5000)                                 │
│  Flask-Login session guard on every data route           │
│  blueprints: auth, transactions, dashboard, budgets,     │
│              goals, ai, reports                          │
└──────┬─────────────────────────────┬─────────────────────┘
       │                             │
       ▼                             ▼
┌───────────────────┐   ┌──────────────────────────────────┐
│ DATA              │   │ AI / ML  (pure functions)        │
│ SQLAlchemy 2 ORM  │   │ categorizer · analytics · health │
│ SQLite finwise.db │   │ anomaly · savings · chat         │
└───────────────────┘   └──────────────────────────────────┘
```

### Why a dev proxy instead of CORS
The browser sees one origin, so the Flask session cookie is first-party and
requires no `SameSite=None`, no preflight handling and no CORS allowlist. Three
lines in `vite.config.js` replace an entire middleware concern.

## 3. Request lifecycle

1. A page calls the single wrapper in `src/api.js`.
2. Vite proxies `/api/*` to Flask.
3. `@login_required` rejects anonymous callers with **401**.
4. The handler validates the request body and returns **400** with a field-level
   message on bad input.
5. Every query is filtered by `current_user.id`. **No endpoint ever accepts a
   user id from the client** — that is the entire user-isolation model.
6. Rows are handed to an `ai/*` function. Those functions take plain Python data
   and return plain Python data, which is why they are unit-testable without a
   database or an HTTP server.
7. JSON goes back to the page, which feeds Recharts.

## 4. Module responsibilities

### backend/
| File | Owns |
|---|---|
| `app.py` | Flask factory, Flask-Login wiring, blueprint registration, idempotent schema init |
| `config.py` | Reads env via python-dotenv. The only place secrets are touched |
| `models.py` | Six tables. All financial amounts are `Numeric`, never `Float` |
| `routes/auth.py` | register, login, logout, me |
| `routes/transactions.py` | CRUD plus search / category / date-range / type filters |
| `routes/dashboard.py` | One aggregate call that fills all dashboard tiles and charts |
| `routes/budgets.py` | Overall and per-category budgets, utilization, alerts |
| `routes/goals.py` | Savings goals and progress |
| `routes/ai.py` | categorize, analyze, financial-health, chat, predict-savings, detect-anomalies |
| `routes/reports.py` | Monthly report JSON, PDF (reportlab), CSV (stdlib) |
| `reporting.py` | `build_report()` plus PDF and CSV rendering. The JSON and the PDF come from one call, so a download cannot disagree with the screen |
| `validation.py` | One `{error, field}` shape and one 400 for every endpoint |

### backend/ai/
| File | Technique | Not magic because |
|---|---|---|
| `categorizer.py` | TF-IDF (word + char n-grams) → ComplementNB | Trained on `data/training_data.csv`; `predict_proba` gives the confidence shown in the UI; below threshold → `Other` |
| `analytics.py` | Plain-Python aggregation, month-over-month deltas | Pure arithmetic over the user's rows — no text generation. Templated insight strings, never generated text |
| `health.py` | Transparent weighted rubric, 100 points | Weights are returned to the client and rendered, so the score is auditable |
| `anomaly.py` | Per-category median/MAD robust z-score + IsolationForest | Two independent signals; needs a minimum history or it abstains |
| `savings.py` | Closed-form least-squares fit over the monthly net-savings series | Not sklearn: on one feature `LinearRegression` wraps this exact arithmetic. Only complete months are fitted, and a fit below r²=0.3 is discarded for the average rather than projected |
| `chat.py` | Gemini with the user's real aggregates injected; rule-based intent engine on failure | The system prompt forbids inventing transactions; the fallback answers from the same aggregates |

### frontend/src/
| File | Owns |
|---|---|
| `api.js` | The only place `fetch` is called. Normalises errors, handles 401 → redirect |
| `auth.jsx` | `AuthContext`, `useAuth`, `ProtectedRoute` |
| `theme.jsx` | Light/dark, toggles the `class` on `<html>`, persisted to localStorage |
| `format.js` | `Intl.NumberFormat('en-IN')` for ₹. Formatting happens here and nowhere else |
| `components/` | Sidebar, StatCard, chart wrappers, TransactionForm, DataTable, Modal, ProgressBar |
| `pages/` | One file per sidebar destination |

## 5. Database schema

```
users 1──* transactions
      1──* budgets            unique(user_id, category, month, year)
      1──* savings_goals
      1──* financial_insights
      1──1 user_preferences
```

`users` — id · email (unique) · password_hash · name · monthly_income ·
emergency_fund · is_demo · created_at

`transactions` — id · **user_id FK** · description · amount (Numeric) ·
category · txn_type (income|expense) · date · payment_method · notes ·
ai_category · ai_confidence · was_corrected

`budgets` — id · **user_id FK** · category (NULL = overall) · amount · month · year

`savings_goals` — id · **user_id FK** · name · target_amount · saved_amount ·
target_date · status

`financial_insights` — id · **user_id FK** · kind · title · body · severity · created_at

> **Currently unused by the application.** Insights are generated on demand from
> the user's rows by `ai/analytics.py` and are not persisted, so this table holds
> zero rows. It is part of the specified schema and its cascade behaviour is
> tested; giving the Insights page history would be the reason to start writing
> to it.

`user_preferences` — id · **user_id FK** (unique) · theme · currency · alerts_enabled

Schema is created by an idempotent `db.create_all()` at app start. A migration
tool is deliberately omitted: a single-file SQLite database with no deployed
history has nothing to migrate, and Alembic would be ceremony with no payoff.

## 6. Security model

- Passwords hashed with `werkzeug.security` (scrypt). Never logged.
- `SECRET_KEY` and `GEMINI_API_KEY` come from the environment only. The Gemini
  key is used server-side in `ai/chat.py` and is never serialised into any
  response, so it cannot reach the browser.
- Session cookie: `HttpOnly`, `SameSite=Lax`.
- Authorization is row-level and implicit: the user id comes from the session,
  never from the payload or the URL.
- Write validation: amount > 0, parseable ISO date, category within the enum,
  `txn_type` within {income, expense}, description length-capped.

## 7. Honesty constraints

The health score is a transparent rubric, not a credit score, and the UI says so.
Savings forecasts and anomaly flags are labelled estimates. An anomaly is
"unusual spending to verify", never "fraud". The assistant is instructed not to
invent transaction history and carries a financial-advice disclaimer.

## 8. Windows path caveat (this project specifically)

The project's absolute path contains an `&`:

```
C:\AI-Powered Smart Personal Finance & Spending Intelligence System
```

cmd.exe treats `&` as a command separator, and npm's generated
`node_modules/.bin/*.cmd` shims interpolate the directory into a cmd command
line. Running `npx vite` or an npm script that invokes a `.bin` shim therefore
fails with a misleading pair of errors:

```
'Spending' is not recognized as an internal or external command
Error: Cannot find module 'C:\vite\bin\vite.js'
```

`npm install` is unaffected (it touches no shim), so the fault appears only at
first run. **Mitigation applied:** `frontend/package.json` scripts call Vite's
entry point through node directly and never touch the shim:

```json
"dev": "node node_modules/vite/bin/vite.js"
```

This keeps the folder name intact. If you add another CLI tool that needs a
`.bin` shim, invoke it the same way — or rename the directory to drop the `&`,
which fixes every tool at once. The Python side is unaffected: PowerShell and
the venv handle the quoted path correctly.
