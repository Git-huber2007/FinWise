# FinWise

[![Python 3.12](https://img.shields.io/badge/Python-3.12-blue.svg)](https://python.org)
[![React 18](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-00E699.svg)](https://neon.tech)
[![Vercel Ready](https://img.shields.io/badge/Vercel-Deployed-black.svg)](https://finwise-omega-nine.vercel.app/)

FinWise is a personal finance and spending intelligence web application. It combines double-entry style ledger tracking, monthly category limits, statistical anomaly detection, and offline transaction classification powered by Scikit-Learn.

- **Live Application**: [https://finwise-omega-nine.vercel.app/](https://finwise-omega-nine.vercel.app/)


---

## Architecture

<p align="center">
  <a href="https://finwise-omega-nine.vercel.app/architecture.html">
    <img src="https://raw.githubusercontent.com/Git-huber2007/FinWise/main/docs/architecture-animated.svg" alt="FinWise System Architecture" width="100%">
  </a>
</p>

The system runs as an all-in-one deployment on Vercel:
- **Client**: React 18 single-page application built with Vite and Tailwind CSS.
- **API**: Flask 3.0.3 WSGI service with session authentication and request validation.
- **Database**: Serverless PostgreSQL hosted on Neon (with local SQLite fallback for offline development).
- **Categorization**: Local Scikit-Learn Complement Naive Bayes model trained with TF-IDF character and word n-grams for instant sub-second merchant classification.
- **Reporting**: Automated PDF statement generation using ReportLab with full Indian Rupee (`₹`) formatting.

---

## Features

- **Ledger & Cash Flow**: Track inflows, outflows, and net retention with chronological register sheets and trajectory charts.
- **Merchant Auto-Categorization**: Real-time classification running locally in Python without external API calls; user corrections retrain the model online.
- **Budget Limits**: Define monthly spending ceilings per category with 80% and 100% utilization tracking.
- **Financial Health Score**: Transparent 100-point rubric calculated across savings rate, budget discipline, and spending stability.
- **Savings Goals**: Goal ETA projections based on historical monthly net retention rates.
- **PDF & CSV Export**: Download monthly statements with audit summaries and export full transaction history to CSV.
- **Assistant**: Natural-language ledger query interface with deterministic rule-based calculation and optional Gemini 2.5 Flash phrasing.

---

## Tech Stack

| Component | Technology |
|---|---|
| **Frontend** | React 18, Vite 8, Tailwind CSS, Recharts, Lucide Icons |
| **Backend** | Python 3.12, Flask 3.0, Flask-Login, Flask-CORS |
| **Database** | PostgreSQL (Neon Cloud) / SQLite (Local), SQLAlchemy 2.0 |
| **Machine Learning** | Scikit-Learn (TF-IDF + ComplementNB), NumPy, Joblib |
| **Documents** | ReportLab (PDF), CSV |
| **Hosting** | Vercel (SPA + Serverless WSGI Functions) |

---

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 20+

### 1. Backend Setup

```bash
cd finwise/backend

# Create and activate virtual environment
python -m venv .venv
# Windows:
.\.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Seed initial database (creates tables & sample data)
python seed.py --reset

# Start API server (runs on http://localhost:5000)
python app.py
```

### 2. Frontend Setup

In a separate terminal:

```bash
cd finwise/frontend

# Install dependencies
npm install

# Start development server (runs on http://localhost:5173)
npm run dev
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | No | PostgreSQL connection URL (e.g. Neon). Defaults to local SQLite (`finwise.db`) if unset. |
| `SECRET_KEY` | In Prod | Session signing key (generate with `python -c "import secrets; print(secrets.token_hex(32))"`). |
| `SESSION_COOKIE_SECURE` | In Prod | Set to `1` when served over HTTPS (e.g. Vercel) to enforce secure session cookies. |
| `GEMINI_API_KEY` | No | Google AI Studio API key for optional Gemini 2.5 Flash assistant mode. |
| `CORS_ORIGINS` | No | Comma-separated list of allowed origins. Defaults to empty for same-origin proxying. |

---

## Deployment to Vercel

The project includes root [`vercel.json`](vercel.json) and [`api/index.py`](api/index.py) configuration for single-repo deployment:

1. Import the repository into [Vercel](https://vercel.com).
2. Set the environment variables in project settings:
   - `DATABASE_URL`: Your Neon PostgreSQL connection string.
   - `SECRET_KEY`: A random 32-byte hex string.
   - `SESSION_COOKIE_SECURE`: `1`
3. Click **Deploy**. Vercel builds the React frontend and deploys the Flask API as a serverless function with zero CORS latency.

---

## License

MIT License.
