# Contributing to FinWise

Thank you for your interest in contributing to FinWise! We welcome contributions to make personal finance intelligence faster, cleaner, and strictly privacy-first.

## Design Philosophy & Standards

FinWise is built on three core engineering tenets:

1. **Zero Mock Data / Real Ledger Accounting**: Every balance, rubric metric, forecast, and chart must derive strictly from immutable ledger transactions. Nothing is hallucinated.
2. **Local-First & Offline Resilience**: Core machine learning (TF-IDF + Complement Naive Bayes categorizer) and analytics run locally in sub-millisecond execution. External cloud APIs (like Google Gemini) are optional progressive enhancements.
3. **Swiss Hairline / Anti-Slop Design**: We adhere to clean, high-density Swiss typography, muted monospaced numeric tabular data (`tnum`), and hairline borders (`border-ink-200`). Avoid flashy AI glows, decorative gradients, robot avatars, or unnecessary animations.

---

## Local Development Workflow

### 1. Prerequisites
- **Python**: 3.11+ (Python 3.12 recommended)
- **Node.js**: 20+
- **Git**

### 2. Backend Setup
```bash
cd finwise/backend
python -m venv .venv

# Activate venv:
# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# macOS / Linux:
source .venv/bin/activate

pip install -r requirements.txt
python seed.py --reset     # Seed local SQLite database with demo ledger
python app.py              # Starts server at http://localhost:5000
```

### 3. Frontend Setup
```bash
cd finwise/frontend
npm install
npm run dev                # Starts Vite dev server at http://localhost:5173
```

---

## Verification & Quality Gates

Before opening a pull request, verify that both test suites and builds pass cleanly:

### Run Backend Tests (281 tests)
```bash
cd finwise/backend
python -m pytest tests/
```

### Run Frontend Build
```bash
cd finwise/frontend
npm run build
```

---

## Commit Guidelines

We use conventional commit messages:

- `feat:` New features or capabilities
- `fix:` Bug fixes or calculation corrections
- `refactor:` Code improvements without behavioral changes
- `style:` Design system and layout adjustments
- `test:` Test suite additions or enhancements
- `docs:` Documentation updates
