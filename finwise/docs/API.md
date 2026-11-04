# FINWISE AI — API reference

35 endpoints under `/api`. JSON in, JSON out, except the two file exports.

Base URL in development: `http://localhost:5000`. The Vite dev server proxies `/api`
there, so the browser makes same-origin requests and no CORS configuration exists.

---

## Conventions

### Authentication

Session cookie, set by `POST /api/login` or `POST /api/register`. The cookie is
`HttpOnly` and `SameSite=Lax`. Browser clients must send `credentials: 'include'`.

Every endpoint except `/api/health`, `/api/meta`, `/api/register` and `/api/login`
requires a session and returns **401** without one:

```json
{ "error": "authentication required" }
```

This is a JSON 401, not Flask-Login's default 302 to a login page — a redirect appears
to `fetch()` as a confusing opaque response.

### Authorization

Every query filters on `current_user.id`. **No endpoint accepts a user id from the
client.** A row belonging to another user does not exist as far as the query is
concerned, so cross-user access returns **404, not 403** — a 403 would confirm the row
exists.

### Errors

One shape everywhere:

```json
{ "error": "Name is required.", "field": "name" }
```

| Status | Meaning |
|---|---|
| 400 | Validation failed. `field` names the offending input. |
| 401 | No session, or an expired one. |
| 404 | Not found, or owned by someone else. |
| 409 | Conflict — a duplicate that must be edited rather than created. |
| 500 | Logged server-side; the response body is generic and leaks nothing. |

### Money and dates

Amounts are JSON numbers, stored as `NUMERIC(12,2)` — never floats in the database.
Dates are `YYYY-MM-DD`; months are `YYYY-MM`.

---

## System

### `GET /api/health`

Liveness plus enough introspection to verify an install. No auth required.

```json
{
  "status": "ok",
  "service": "finwise-api",
  "version": "1.0.0",
  "pid": 18584,
  "started_at": "2026-11-04T15:40:11+00:00",
  "database": { "dialect": "sqlite", "tables": ["budgets", "..."] },
  "llm_configured": false,
  "blueprints": { "loaded": ["auth", "transactions", "..."], "missing": {} }
}
```

`pid` and `started_at` identify **which process answered** — a dev server that fails to
bind leaves its predecessor serving, so a response is otherwise no evidence that it came
from the code you just changed.

`llm_configured` is a boolean only. The Gemini key never leaves the server.

`blueprints.missing` distinguishes "this module does not exist" from
`"FILE EXISTS BUT IMPORT FAILED: ..."`, so a broken import cannot masquerade as an
unbuilt feature.

### `GET /api/meta`

Vocabulary for dropdowns — `categories`, `txn_types`, `payment_methods` — served from
one place so the frontend cannot drift from what the API validates against.

---

## Authentication

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/register` | Create an account and sign in |
| POST | `/api/login` | Sign in |
| POST | `/api/logout` | Sign out |
| GET | `/api/me` | Current user and preferences |
| PUT | `/api/me` | Update profile |
| PUT | `/api/me/password` | Change password |

**`POST /api/register`**

```json
{ "email": "asha@example.com", "password": "at-least-8-chars", "name": "Asha Rao" }
```

→ **201** with the user object. Duplicate email → **409**, caught by the unique index
rather than a pre-check `SELECT`.

**`POST /api/login`** → **200**, or **401** with a message that is **identical for an
unknown email and a wrong password**, so the endpoint cannot be used to enumerate
accounts.

**`POST /api/logout`** → `{ "ok": true }`. Clears the session *and* the remember-me
cookie. (Order matters here: `session.clear()` after `logout_user()` erases the
instruction that deletes that cookie, which left a usable credential behind. There is a
regression test asserting on the cookie jar.)

**`GET /api/me`** → `{ "user": {...}, "preferences": {...} }`. Passwords are stored
with `werkzeug.security.generate_password_hash` (scrypt) and never returned.

---

## Transactions

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/transactions` | Filtered, paginated list |
| POST | `/api/transactions` | Create |
| PUT | `/api/transactions/<id>` | Update |
| DELETE | `/api/transactions/<id>` | Delete |

**Query parameters** (all optional, combined with AND): `search`, `category`,
`txn_type`, `start_date`, `end_date`, `payment_method`, `limit` (max 200), `offset`.

`search` matches description or notes. A literal `%` or `_` in the search term is
escaped so it is matched as a character rather than acting as a LIKE wildcard.

```json
{
  "transactions": [ ... ],
  "total": 264,
  "limit": 50,
  "offset": 0,
  "totals": { "income": 433263.0, "expense": 368372.0, "net": 64891.0 }
}
```

`totals` describes **the whole filtered set, not the current page** — otherwise the
summary silently changes as the user pages through.

**`POST /api/transactions`**

```json
{
  "description": "Swiggy food order",
  "amount": 450.00,
  "category": "Food",
  "txn_type": "expense",
  "date": "2026-11-04",
  "payment_method": "UPI",
  "ai_category": "Food",
  "ai_confidence": 0.98
}
```

Required: `description`, `amount` (> 0), `category`, `txn_type`. `date` defaults to
today. If `ai_category` is supplied and differs from `category`, the row is flagged
`was_corrected` — this is the retraining signal.

---

## Dashboard

### `GET /api/dashboard?month=YYYY-MM`

One call fills every tile and every chart. Deliberately one request rather than six:
the figures must be internally consistent, and six round trips can interleave with a
write and show totals that do not add up.

Returns `totals`, `previous`, `budget`, `health_score`, `health_band`,
`health_provisional`, `monthly_series`, `category_breakdown`, `comparison`,
`budget_alerts`, `recent_transactions`, `insights`, `anomalies`, `has_data`.

`month` defaults to the current calendar month, falling back to the most recent month
with data — otherwise a dataset ending last month renders an empty dashboard and looks
broken.

---

## Budgets

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/budgets?month=YYYY-MM` | Budgets with utilisation |
| POST | `/api/budgets` | Create |
| PUT | `/api/budgets/<id>` | Update |
| DELETE | `/api/budgets/<id>` | Delete |

```json
{ "category": "Food", "amount": 9000, "month": 11, "year": 2026 }
```

A **null, absent or `"overall"` category means the overall monthly budget.** Every
category except `Salary` can be budgeted; `Investments` can, because a monthly SIP is an
expense even though a dividend is income.

**409** on a duplicate for the same category and month. This is enforced by an explicit
query, **not** by the unique index: SQL treats NULLs as distinct, so
`UNIQUE(user_id, category, month, year)` does not prevent a second *overall* budget —
verified by writing two directly to the table and getting both.

The GET response carries `budgets` (each with `spent`, `remaining`, `used_pct`,
`status`), `overall`, `totals`, `unbudgeted` (spending in categories with no budget),
`available_categories`, `typical` (recent average per category, for suggesting an
amount) and `warn_at_pct`.

`status` is `ok`, `warning` (≥ 80% used) or `over` (> 100%). Exactly 100% is `warning`,
not `over`.

---

## Savings goals

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/goals` | Goals with projected completion dates |
| POST | `/api/goals` | Create |
| PUT | `/api/goals/<id>` | Update |
| POST | `/api/goals/<id>/contribute` | Add to the saved amount |
| DELETE | `/api/goals/<id>` | Delete |

```json
{ "name": "New laptop", "target_amount": 75000, "saved_amount": 28000,
  "target_date": "2027-07-02" }
```

`saved_amount` exceeding `target_amount` → **400**.

**`/contribute`** takes `{ "amount": 2000 }` and adds to the saved amount, clamped at
the target. It is a separate endpoint rather than a `PUT` because "I saved ₹2,000 this
month" expressed as a read-modify-write is a race that can lose a contribution.

Every goal carries a `projection` with `months_needed`, `eta`, `eta_label`, `status`
(`on_track` / `behind` / `stalled` / `achieved`) and a `note` stating that the estimate
assumes the user's whole net saving goes to that goal.

---

## AI

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/ai/categorize` | Predict a category |
| GET | `/api/ai/categorize/stats` | Correction counts, acceptance rate |
| POST | `/api/ai/categorize/retrain` | Refit on this user's corrections |
| GET | `/api/ai/model-info` | Measured model accuracy |
| POST | `/api/ai/analyze` | Spending analysis for a month |
| POST | `/api/ai/financial-health` | Health score with full breakdown |
| POST | `/api/ai/predict-savings` | Savings forecast + goal projections |
| POST | `/api/ai/detect-anomalies` | Unusually large expenses |
| POST | `/api/ai/chat` | The assistant |
| GET | `/api/ai/chat/starters` | Suggested questions, `llm_configured` |

### `POST /api/ai/categorize`

```json
{ "description": "Swiggy order" }
```

```json
{
  "description": "Swiggy order",
  "category": "Food",
  "confidence": 0.9875,
  "confident": true,
  "floor": 0.28,
  "alternatives": [
    { "category": "Food", "confidence": 0.9875 },
    { "category": "Shopping", "confidence": 0.0022 }
  ]
}
```

Below the floor, `category` is `"Other"` and `confident` is `false`, so the UI can show
a weak guess as a suggestion rather than as an answer.

### `POST /api/ai/predict-savings`

Optional `{ "horizon": 3 }`, clamped to 6.

Returns `method` (`linear_trend` / `average` / `insufficient_data`), `method_label`,
`confidence`, `r2`, `fitted_r2`, `slope_per_month`, `predictions`, `predicted_next`,
`history`, `volatility`, `months_of_history`, `explanation`, `goals`, `disclaimer`.

`r2` is 0 when a fit was rejected; `fitted_r2` is what it actually scored, so the UI can
explain the rejection instead of silently showing an average.

### `POST /api/ai/detect-anomalies`

`{ "month": "2026-10" }` scopes the report to a month. `{ "month": null }` reports the
whole history. **Statistics are always built from the whole history** — one month is not
enough data to know what is normal.

Each anomaly carries `amount`, `typical`, `times_typical`, `robust_z`, `method`,
`forest_agrees`, `severity`, `reason` and **`needs_review: true`**. The response
includes a `note` stating these are not fraud alerts.

### `POST /api/ai/chat`

```json
{ "message": "Where did my money go?" }
```

```json
{
  "answer": "Your biggest category in Nov 2026 so far is Transportation at ₹1,454 ...",
  "source": "rules",
  "used_your_data": true,
  "notice": "The AI model was unavailable, so this answer came from the built-in engine.",
  "suggestions": ["..."],
  "disclaimer": "..."
}
```

`source` is `"gemini"` or `"rules"`. **This endpoint has no failure path**: every Gemini
error — missing key, bad key, no network, quota, timeout — is caught and answered by the
rule engine with **200** and a `notice`. The UI badges the two sources differently so a
fallback can never be mistaken for a model answer.

---

## Reports

| Method | Path | Returns |
|---|---|---|
| GET | `/api/reports/monthly?month=YYYY-MM` | JSON report |
| GET | `/api/reports/monthly.pdf?month=YYYY-MM` | `application/pdf` |
| GET | `/api/reports/transactions.csv` | `text/csv; charset=utf-8` |

The JSON and the PDF are rendered from **one `build_report()` call**, so a downloaded
report cannot disagree with the page it was downloaded from.

The JSON carries `meta` (including `is_sample_data`, `partial_month` and
`available_months`), `totals`, `previous_totals`, `category_breakdown`, `comparison`,
`budget_alerts`, `health`, `forecast`, `goals`, `anomalies`, `insights` and
`transactions`.

**PDF** — `Content-Disposition: attachment`. A demo account's report is stamped
`SAMPLE DATA` in a banner above the first figure and in every page footer. Amounts are
written `Rs.` rather than `₹`: Helvetica has no U+20B9 and reportlab draws a missing
glyph as a filled black box rather than raising.

**CSV** — accepts the same filters as `GET /api/transactions`, so an export honours
exactly what the user had applied. **Never paginated** — an export that silently stopped
at 50 rows would look complete. Encoded `utf-8-sig`, because Excel on Windows assumes
the system codepage without a BOM. `X-Row-Count` carries the row count.
