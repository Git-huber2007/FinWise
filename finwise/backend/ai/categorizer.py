"""Transaction category prediction.

Model
-----
A scikit-learn Pipeline: TF-IDF features -> ComplementNB.

*Why TF-IDF over word AND character n-grams.* Transaction descriptions are
short and misspelled ("swiggi", "SWIGGY ORDER", "uber ride to colg"). Word
features alone miss every typo and every run-together string; character 3-5
grams catch "swigg" inside all of them. The two are combined with
FeatureUnion so each contributes.

*Why ComplementNB over MultinomialNB.* Complement Naive Bayes is designed for
imbalanced text corpora and is markedly steadier when one class has more
examples than another, which is the normal state of this data as users correct
their own transactions.

*Why Naive Bayes at all, rather than a transformer.* It trains in well under a
second on a laptop with no GPU, retrains online after every user correction,
and exposes calibrated-enough `predict_proba` for the confidence score the UI
shows. A fine-tuned transformer would be more accurate and completely
impractical to retrain per-correction in a college project.

Honesty
-------
`predict_proba` on Naive Bayes is confident-by-construction and should not be
read as a true probability. It is used only to rank and to apply a floor, and
the UI presents it as the model's confidence, never as a correctness guarantee.
Below CONFIDENCE_FLOOR the model declines and returns "Other".
"""
from __future__ import annotations

import csv
import threading
from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import ComplementNB
from sklearn.pipeline import FeatureUnion, Pipeline

from constants import CATEGORIES, CONFIDENCE_FLOOR

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
TRAINING_CSV = DATA_DIR / "training_data.csv"
MODEL_PATH = Path(__file__).resolve().parent / "model.joblib"

# Training is cheap but not instantaneous; one lock keeps two concurrent
# requests from training twice and racing to write the same file.
_lock = threading.Lock()
_model: Pipeline | None = None


@dataclass
class Prediction:
    category: str
    confidence: float
    alternatives: list[dict]
    # False when the model declined to guess (below the floor).
    confident: bool

    def to_dict(self) -> dict:
        return {
            "category": self.category,
            "confidence": round(self.confidence, 4),
            "confident": self.confident,
            "alternatives": self.alternatives,
            "floor": CONFIDENCE_FLOOR,
        }


def _build_pipeline() -> Pipeline:
    return Pipeline(
        [
            (
                "features",
                FeatureUnion(
                    [
                        # Whole words: catches "salary", "rent", "netflix".
                        ("word", TfidfVectorizer(
                            analyzer="word",
                            ngram_range=(1, 2),
                            sublinear_tf=True,
                            min_df=1,
                            lowercase=True,
                        )),
                        # Character n-grams inside word boundaries: catches
                        # "swigg" in "swiggy"/"swiggi"/"swiggyorder".
                        ("char", TfidfVectorizer(
                            analyzer="char_wb",
                            ngram_range=(3, 5),
                            sublinear_tf=True,
                            min_df=1,
                            lowercase=True,
                        )),
                    ]
                ),
            ),
            # alpha below 1.0 smooths less, which suits a small vocabulary
            # where a single distinctive token should carry real weight.
            ("clf", ComplementNB(alpha=0.3)),
        ]
    )


def load_seed_corpus() -> tuple[list[str], list[str]]:
    if not TRAINING_CSV.exists():
        raise FileNotFoundError(
            f"{TRAINING_CSV} is missing. Run: python data/build_training_data.py"
        )
    texts, labels = [], []
    with TRAINING_CSV.open(encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            description = (row.get("description") or "").strip()
            category = (row.get("category") or "").strip()
            if description and category in CATEGORIES:
                texts.append(description)
                labels.append(category)
    if not texts:
        raise ValueError(f"{TRAINING_CSV} contained no usable rows")
    return texts, labels


def train(extra: list[tuple[str, str]] | None = None, persist: bool = True) -> Pipeline:
    """Fit on the seed corpus plus any user corrections.

    `extra` is the user's corrected transactions. They are appended rather than
    replacing the seed data: a handful of corrections must nudge the model, not
    wipe out everything it knows.
    """
    texts, labels = load_seed_corpus()

    if extra:
        for description, category in extra:
            description = (description or "").strip()
            if description and category in CATEGORIES:
                # Repeat each correction so a deliberate user signal outweighs
                # a single seed phrase without drowning the corpus.
                for _ in range(3):
                    texts.append(description)
                    labels.append(category)

    pipeline = _build_pipeline()
    pipeline.fit(texts, labels)

    if persist:
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(pipeline, MODEL_PATH)
    return pipeline


def get_model() -> Pipeline:
    """Return the in-process model, training or loading it on first use."""
    global _model
    if _model is not None:
        return _model
    with _lock:
        if _model is not None:
            return _model
        if MODEL_PATH.exists():
            try:
                _model = joblib.load(MODEL_PATH)
                return _model
            except Exception:
                # A corrupt or version-mismatched pickle must not take the API
                # down; retraining costs under a second.
                MODEL_PATH.unlink(missing_ok=True)
        _model = train()
        return _model


def retrain(extra: list[tuple[str, str]] | None = None) -> Pipeline:
    """Rebuild from the seed corpus plus corrections and swap it in."""
    global _model
    with _lock:
        _model = train(extra=extra)
        return _model


def predict(description: str, top_k: int = 3) -> Prediction:
    """Predict a category for one description.

    Returns "Other" with confident=False when the description is empty or the
    best score falls below the floor -- an honest "I don't know" beats a
    confident wrong label the user then has to notice and undo.
    """
    text = (description or "").strip()
    if not text:
        return Prediction("Other", 0.0, [], confident=False)

    model = get_model()
    probabilities = model.predict_proba([text])[0]
    classes = list(model.classes_)

    order = np.argsort(probabilities)[::-1]
    ranked = [
        {"category": classes[i], "confidence": round(float(probabilities[i]), 4)}
        for i in order[:top_k]
    ]

    best_category = classes[order[0]]
    best_score = float(probabilities[order[0]])
    confident = best_score >= CONFIDENCE_FLOOR

    return Prediction(
        category=best_category if confident else "Other",
        confidence=best_score,
        alternatives=ranked,
        confident=confident,
    )


EVAL_CSV = DATA_DIR / "eval_phrases.csv"


def evaluate(test_size: float = 0.25, seed: int = 42) -> dict:
    """Held-out accuracy on the seed corpus -- the PESSIMISTIC number.

    This splits the corpus itself, so a held-out row is usually the only place
    its merchant name appears. It therefore measures "classify a merchant you
    have never seen", which is the hardest possible framing and not what the
    app mostly does. Reported because it is the standard metric and
    understating is the safe direction; see evaluate_realistic() for the
    number that reflects actual use.
    """
    from sklearn.model_selection import train_test_split

    texts, labels = load_seed_corpus()
    x_train, x_test, y_train, y_test = train_test_split(
        texts, labels, test_size=test_size, random_state=seed, stratify=labels
    )
    pipeline = _build_pipeline()
    pipeline.fit(x_train, y_train)
    accuracy = float(pipeline.score(x_test, y_test))
    return {
        "accuracy": round(accuracy, 4),
        "train_size": len(x_train),
        "test_size": len(x_test),
        "classes": sorted(set(labels)),
    }


def evaluate_realistic() -> dict:
    """Accuracy on full-sentence phrasings a user would actually type.

    data/eval_phrases.csv is a separate hand-written set whose rows appear
    nowhere in the training corpus -- they are sentences ("ordered dinner from
    zomato"), not the bare tokens the model trains on. This measures the thing
    the user experiences: known merchants in unfamiliar wording.

    Keeping both numbers is the point. Quoting only this one would flatter the
    model; quoting only the held-out split would understate it.

    KNOWN BIAS, stated plainly: the same author wrote the training corpus and
    this eval set, so they share assumptions about how people phrase things.
    That makes this an OPTIMISTIC bound, not a neutral benchmark. The honest
    reading is that the two metrics bracket real performance -- ~64% when the
    merchant is entirely unknown, near-perfect when it is a known merchant in
    new wording. A genuinely neutral figure would need descriptions collected
    from real users, which this project does not have.
    """
    if not EVAL_CSV.exists():
        raise FileNotFoundError(f"{EVAL_CSV} is missing")

    with EVAL_CSV.open(encoding="utf-8") as fh:
        rows = [(r["description"].strip(), r["category"].strip())
                for r in csv.DictReader(fh) if r.get("description")]

    training = set(load_seed_corpus()[0])
    leaked = [t for t, _ in rows if t in training]
    if leaked:
        raise AssertionError(f"eval set leaks into training data: {leaked}")

    get_model()  # ensure the model is loaded before timing/predicting
    misses = []
    correct = 0
    for text, expected in rows:
        result = predict(text)
        if result.category == expected:
            correct += 1
        else:
            misses.append({"text": text, "expected": expected,
                           "got": result.category,
                           "confidence": round(result.confidence, 3)})

    return {
        "accuracy": round(correct / len(rows), 4),
        "n": len(rows),
        "correct": correct,
        "misses": misses,
    }
