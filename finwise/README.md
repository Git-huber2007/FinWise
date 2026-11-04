# FINWISE AI

An AI-powered personal finance and spending intelligence platform. Flask + SQLite on
the backend, React + Vite on the front, scikit-learn for the machine learning, and an
optional Google Gemini integration for the assistant.

Every figure the application shows is computed from transactions recorded in the
database. Nothing is mocked, and nothing is invented.

---

## Requirements

| | Version used | Notes |
|---|---|---|
| Python | 3.12 | 3.11+ should work |
| Node.js | 24 | 20+ should work |

No paid services and no network access are required. The AI assistant falls back to a
built-in rule engine when no Gemini key is configured, and everything else — the
categoriser, anomaly detection, savings forecast, health score — runs entirely locally.

---

## Install and run

Two terminals. Backend first.

### 1. Backend

```bash
cd finwise/backend

python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt  # macOS / Linux

.venv/Scripts/python.exe seed.py      # creates finwise.db with 8 months of demo data
.venv/Scripts/python.exe app.py       # http://localhost:5000
```

`seed.py` will not overwrite existing demo data. Pass `--reset` to rebuild it.

### 2. Frontend

```bash
cd finwise/frontend
npm install
npm run dev                            # http://localhost:5173
```

Open **http://localhost:5173** and sign in with:

```
demo@finwise.ai
demo1234
```

Or register a new account — the app works from zero data and tells you what it cannot
yet calculate.

> **If `npm run dev` fails with `'...' is not recognized`:** the project path contains
> an `&`, which `cmd.exe` treats as a command separator, breaking npm's generated
> `.cmd` shims. The scripts in `package.json` already call `node node_modules/vite/bin/vite.js`
> directly to avoid this. If you hit it with another tool, run it the same way or move
> the project to a path without `&`.

---

## Verify it works

```bash
cd finwise/backend
.venv/Scripts/python.exe -m pytest -q      # 264 tests
.venv/Scripts/python.exe -m ty check .     # type checker, no suppressions
```

```bash
cd finwise/frontend
npm run build                              # production build
```

---

## Enabling Gemini (optional)

The assistant works without this. To use Gemini as the primary engine:

```bash
cd finwise/backend
cp .env.example .env
# then set GEMINI_API_KEY=your-key-here
```

The key is read server-side only and never reaches the browser. `GET /api/health`
reports `llm_configured` as a boolean and never echoes the key itself.

When Gemini is unavailable — no key, a bad key, no network, a quota error — the request
still returns **200** with an answer from the rule engine, tagged `source: "rules"` and
carrying a visible notice. The assistant has no path that returns an error instead of an
answer.

---

## What to look at

A five-minute tour, in order:

1. **Dashboard** — ten metrics and five charts, all from the seeded transactions.
   The amber banner at the top flags two unusually large expenses.
2. **Transactions** — 264 rows with search and filters. Add one and watch the
   dashboard figure move by exactly that amount. The category is predicted as you
   type the description; overriding it is recorded and feeds retraining.
3. **Budget Planner** — set a limit, then watch utilisation move against real
   spending. Categories you have not budgeted for are listed separately.
4. **AI Insights** — generated from month-over-month movement, with floors that stop
   it reporting trivia.
5. **Financial Health** — a score out of 100 with every component, weight and input
   shown, so the arithmetic can be checked by hand.
6. **Savings Goals** — a forecast that *refuses* to project a trend when the fit does
   not support one, and tells you so.
7. **AI Assistant** — ask "Where did my money go?" or "How can I save ₹5,000 a month?"
8. **Reports** — download the PDF and the CSV.

---

## Project layout

```
finwise/
├── backend/
│   ├── app.py              Flask factory, blueprint registration, /api/health
│   ├── config.py           env-driven config
│   ├── models.py           6 tables, SQLAlchemy 2.0 typed declarative
│   ├── validation.py       one error shape for every endpoint
│   ├── reporting.py        report assembly, PDF and CSV rendering
│   ├── seed.py             demo account and 8 months of data
│   ├── routes/             auth, transactions, dashboard, budgets, goals, ai, reports
│   ├── ai/                 categorizer, analytics, health, chat, savings, anomaly
│   ├── data/               training_data.csv (563 labelled descriptions)
│   └── tests/              264 tests
├── frontend/
│   └── src/
│       ├── api.js          the only place that calls fetch()
│       ├── auth.jsx        AuthContext and ProtectedRoute
│       ├── theme.jsx       light/dark, persisted
│       ├── format.js       ₹ formatting with Indian digit grouping
│       ├── components/     layout, charts, shared UI
│       └── pages/          9 routes
└── docs/
    ├── ARCHITECTURE.md     how the tiers fit together and why
    ├── API.md              every endpoint, request and response
    └── AI.md               which model does what, and how well
```

---

## Honest limitations

These are deliberate and documented rather than hidden.

- **The categoriser scores 63.8% on held-out merchants** it has never seen, and 100% on
  full sentences containing known merchants. Both figures were produced by the same
  author, so treat them as a bracket, not an independent benchmark. See `docs/AI.md`.
- **The health score is not a credit score** and not a professional financial
  assessment. It is a transparent weighted rubric over your own recorded data, and the
  UI says so wherever the score appears.
- **Forecasts are estimates.** The savings forecast refuses to report a trend when the
  fitted line explains less than 30% of the month-to-month variation, falling back to
  an average and saying why.
- **Anomalies are not fraud alerts.** They are expenses that are large relative to your
  own history, presented for confirmation. Nothing is ever auto-labelled as fraud.
- **The assistant ignores time qualifiers.** Asking "what did I spend *last month*"
  answers about the current month — it states which month it used, so the answer is not
  misleading, but it is not the month you asked for.
- **SQLite and `db.create_all()`**, with no migration tool. Appropriate for a
  single-file database with no deployed history; it would not be for a real deployment.
- **The Gemini success path is untested in this build**, because no API key was
  configured during development. The failure path was tested against a real rejection
  from Google's API.

---

## Disclaimer

FINWISE AI is an educational project. It is not financial advice, the health score is
not a credit score, and the forecasts are estimates rather than guarantees. The seeded
demo data is clearly marked as sample data wherever it appears, including in exported
PDFs.
