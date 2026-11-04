# FINWISE AI — the AI, and how well it works

Six modules in `backend/ai/`. Two are genuine machine learning, three are transparent
arithmetic, and one is an LLM integration with a rule-based engine behind it.

This document says which is which, because "AI-powered" is otherwise an unfalsifiable
claim. Where a number can be measured, the measured number is printed here rather than
an aspiration.

| Module | What it is | Genuinely ML? |
|---|---|---|
| `categorizer.py` | TF-IDF → ComplementNB classifier | **Yes** — supervised, trained, measured |
| `anomaly.py` | Robust z-score + IsolationForest | **Yes** — IsolationForest is unsupervised ML |
| `savings.py` | Least-squares linear fit | No — closed-form regression, not a learned model |
| `health.py` | Weighted rubric | No, deliberately |
| `analytics.py` | Aggregation + templated insights | No |
| `chat.py` | Gemini, with a rule engine fallback | LLM, used only for phrasing |

---

## 1. Expense categorisation — `categorizer.py`

**The one place a real classifier earns its keep.** Mapping "SWIGGY*ORDER BLR" to *Food*
is exactly the fuzzy string problem rules are bad at.

### Pipeline

```
FeatureUnion
├── TfidfVectorizer(analyzer="word",    ngram_range=(1,2), sublinear_tf=True)
└── TfidfVectorizer(analyzer="char_wb", ngram_range=(3,5), sublinear_tf=True)
                              ↓
                    ComplementNB(alpha=0.3)
```

The character n-grams are what make it robust to the way merchant strings actually
arrive: `char_wb` 3–5 grams still match `SWIGGY*ORDER` and `Swiggy order` to the same
place, where word tokens alone would not.

**ComplementNB rather than MultinomialNB** because the training classes are imbalanced —
there are many more Food descriptions than Education ones, and ComplementNB is designed
for exactly that.

- Training data: **563 labelled descriptions across 11 categories** (`data/training_data.csv`)
- Model is fitted on first use and cached to `ai/model.joblib`
- `predict_proba` gives a confidence; below **0.28** the model declines and returns
  `Other` with `confident: false`, so a weak guess is shown as a suggestion rather than
  an answer

### Measured accuracy — both numbers, not just the flattering one

| Metric | Score | What it measures |
|---|---|---|
| **Held-out** | **63.8%** (422 train / 141 test) | Classifying a merchant the model has never seen — the hardest case |
| **Realistic** | **100%** (72/72) | Full sentences containing merchants that are in the corpus |

The truth is between them. A real user types a mixture of known merchants (where it
performs like the second number) and novel ones (where it performs like the first).

**Both figures were produced by the same author as the training data**, which is a
genuine source of bias: the test sentences use the phrasing the corpus taught. Treat
this as a bracket, not an independent benchmark. `GET /api/ai/model-info` returns both
figures and this caveat to the UI.

### Learning from corrections

When a user overrides a prediction, the transaction is flagged `was_corrected`. After
3 corrections, retraining appends them to the seed corpus **×3** — never substituting
for it. A handful of overrides should nudge the model, not erase what it knows.

---

## 2. Anomaly detection — `anomaly.py`

**This is not fraud detection and never says the word "fraud."** It finds expenses that
are large *for this user, in this category*, and asks them to confirm. An unusual
purchase is overwhelmingly likely to be a real purchase the user remembers making.

### Primary: robust z-score

Median and MAD per category, with the Iglewicz-Hoaglin threshold of **3.5**.

```
modified z = 0.6745 × (amount − median) / MAD
```

Median and MAD rather than mean and standard deviation **because the outlier we are
hunting would otherwise inflate the very statistics meant to detect it** — one ₹52,000
purchase drags the mean of a shopping category up far enough to make itself look
ordinary.

### Second opinion: IsolationForest

Fitted over all expenses on two features — the amount, and its ratio to the category
median. The ratio is what makes ₹30,000 of rent ordinary and ₹30,000 of food not, which
the raw amount alone cannot express.

**It can only raise confidence in something the z-score already flagged. It is never
allowed to flag on its own**, because isolation is two-tailed: it happily isolates the
user's *smallest* transactions too, and "your ₹40 bus fare is anomalous" is noise.
`random_state` is fixed so the same data always produces the same alerts.

### Why there are three thresholds, not one

| Threshold | Value | Why |
|---|---|---|
| Modified z | 3.5 | The published Iglewicz-Hoaglin value, not tuned by eye |
| Minimum amount | ₹1,500 | Statistically unusual ≠ worth interrupting someone |
| **Minimum excess over typical** | **₹5,000** | See below |
| Minimum category samples | 5 | A median over 2 rows means nothing |

The excess floor exists because of a real false positive. A tightly clustered Utilities
category — broadband and mobile bills around ₹850 — gives MAD a value near 10, so an
ordinary ₹1,871 summer electricity bill scored **5.8 modified z-scores** and was
reported as an anomaly. It cleared the z threshold and the absolute floor and still
meant nothing: ₹1,019 above usual is a warm month, not an event.

A relative measure has no notion of whether the thing it measures matters. Its
denominator is the spread of the comparison set, which can be arbitrarily small.

On the seeded demo data the detector finds exactly the two deliberately planted
anomalies (₹52,000 laptop, ₹24,000 dental) out of 254 expenses, with **zero false
positives**.

---

## 3. Savings prediction — `savings.py`

A least-squares line fitted to monthly net savings. **Not scikit-learn** — on a single
feature `LinearRegression` is a wrapper around a closed form that is three lines of
arithmetic, and importing it would cost a model object and a numpy round-trip to
compute a slope, an intercept and an r². The seam is one function with its own tests,
so swapping it is trivial.

Two rules shape the output:

**Only complete months are fitted.** The current month is a partial sample — on the 4th
it holds the salary but not the rent. Feeding it to the regression tilts the line on an
accident of the calendar.

**A fit that explains nothing is not reported.** Below an r² of **0.3** the line is
discarded for the average, and the user is told why:

> *"Your monthly savings vary too much for a straight line to describe them — the best
> fit over your 7 complete months explains only 3% of the month-to-month variation.
> Rather than project a trend that is not there, this is your average monthly saving
> carried forward."*

This guard exists because the demo data produced an r² of 0.028 and a forecast that
still announced savings were *"rising by about ₹1,483 a month"* — a slope through noise,
stated with a confidence the arithmetic did not support. A confidence label is not a
licence to make the claim anyway.

Goal completion dates round part-months **up** (10,500 at 5,000/month is three months,
not two) and state out loud that they assume the user's whole net saving goes to that
one goal.

---

## 4. Financial health score — `health.py`

**Deliberately not machine learning.** A score that is meant to change someone's
behaviour has to be explainable, so this is a transparent weighted rubric and every
component returns the exact numbers it was computed from.

| Component | Weight |
|---|---|
| Savings rate | 30 |
| Budget discipline | 20 |
| Spending stability | 15 |
| Emergency fund | 15 |
| Income consistency | 10 |
| Tracking habit | 10 |

The two things a user can act on fastest account for half the score, and no single
component can rescue a bad position alone. With no budgets set, budget discipline scores
the **neutral midpoint** rather than zero — not having set a budget is not evidence of
indiscipline. Below 3 months of data the score is returned flagged `provisional`.

It is not a credit score and not a professional financial assessment, and both this
module and every surface that displays it say so.

---

## 5. Insight generation — `analytics.py`

Templates filled with numbers the user could recompute by hand. **No generated text.**

Two floors stop the feed filling with trivia: a category must move by more than
**₹500 *and* 15%** before it is worth mentioning. Without both, "your healthcare
spending rose 300%" appears about a ₹60 difference.

Month-over-month comparisons truncate **both** months to the same elapsed day. Without
that, an in-progress month reports "housing spending fell 100%" the moment the rent is
not yet due — a false conclusion, not an insight.

---

## 6. The assistant — `chat.py`

### Gemini is for phrasing. Python does the arithmetic.

The model is handed **pre-computed aggregates** and told not to recompute anything. A
model asked to sum a column is *usually* right, and "usually" is not a property you want
in a finance application.

`build_context()` uses the same `analytics.py` functions that fill the dashboard, so the
assistant cannot contradict the charts. **Raw descriptions, merchants and dates are
never sent to Gemini** — only aggregates. Cheaper prompt, and the user's transaction
history stays off a third party.

The system prompt forbids inventing figures, guaranteeing returns, and presenting itself
as a financial adviser.

### The rule engine is the correctness floor

It runs when there is no key, **and** it catches every Gemini failure — bad key, no
network, quota, timeout, malformed response. The endpoint has no path that returns an
error instead of an answer. A fallback reply is tagged `source: "rules"`, carries a
notice, and is badged **"Built-in engine"** in the UI, so it can never be mistaken for a
model answer.

Intent matching is a small keyword router — not pretending to be NLU — that falls
through to "I am not sure how to answer that" rather than guessing. **Order matters**,
and it is pinned by a 22-case routing table, because every bug found in it has been an
ordering bug:

| Question | Was routed to | Should be |
|---|---|---|
| "Which mutual **fund** should I invest in?" | emergency_fund | investing |
| "How are my **savings** goals?" | how_to_save | goals |
| "**Where** did my **money** go?" | unknown | top_category |
| "**Where** can I **save money**?" | top_category | how_to_save |

A generic keyword that also appears inside a more specific topic has to be tested after
it.

### Known limitation

The router ignores time qualifiers. "What did I spend last month" answers about the
current month — the answer states which month it used, so it is not misleading, but it
is not the month that was asked for.

---

## Summary of what is measured

| Claim | Evidence |
|---|---|
| Categoriser 63.8% / 100% | `GET /api/ai/model-info`, asserted in `tests/test_categorizer.py` |
| Finds both seeded anomalies, 0 false positives | `tests/test_savings_and_anomaly.py` |
| Forecast refuses a meaningless fit | `tests/test_savings_and_anomaly.py` |
| Health score arithmetic | hand-computed fixtures in `tests/test_analytics_and_health.py` |
| Assistant degrades without an error | `tests/test_chat.py`, plus a live run against a real API rejection |
| Intent routing | 22-case table in `tests/test_chat.py` |
