"""
MedLab — Random Forest abnormality detection: training script.

This is an OFFLINE script (run manually, not deployed). It produces
model.joblib, which api/predict.py loads at inference time.

Why synthetic training data: MedLab does not have PhysioNet/MIMIC-IV
credentialed access within this project's timeline. Chapter 3 already
documents programmatically-generated synthetic data as a supplementary
source for this exact reason — this script is that source, expanded to
be the primary training set.

IMPORTANT: compute_features() here MUST stay identical to the copy in
api/predict.py, or the model will silently receive differently-shaped
input at inference time than it was trained on. If you change one,
change both.
"""

import random
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import joblib

random.seed(42)
np.random.seed(42)

# Mirrors supabase/migrations/004_reference_ranges.sql
REFERENCE_RANGES = {
    ("Haemoglobin", "male"): (13.5, 17.5),
    ("Haemoglobin", "female"): (12.0, 15.5),
    ("White Blood Cell Count", "any"): (4.0, 11.0),
    ("Platelet Count", "any"): (150, 450),
    ("Fasting Blood Glucose", "any"): (3.9, 5.6),
    ("Creatinine", "male"): (62, 106),
    ("Creatinine", "female"): (44, 80),
    ("ALT (SGPT)", "any"): (7, 56),
    ("AST (SGOT)", "any"): (8, 48),
}


def compute_features(value, ref_low, ref_high, history):
    """
    history: list of prior numeric values for this same patient+analyte,
    chronological order (oldest first), NOT including the current value.
    Returns a fixed-length feature vector as a plain list.
    """
    mid = (ref_low + ref_high) / 2
    half = (ref_high - ref_low) / 2
    range_width = ref_high - ref_low

    norm_dist = (value - mid) / half

    n_hist = len(history)
    if n_hist == 0:
        hist_mean = 0.0
        slope = 0.0
    else:
        hist_norm = [(v - mid) / half for v in history]
        hist_mean = float(np.mean(hist_norm))
        if n_hist >= 2:
            xs = np.arange(n_hist)
            slope = float(np.polyfit(xs, hist_norm, 1)[0])
        else:
            slope = 0.0

    return [value, norm_dist, range_width, hist_mean, slope, n_hist]


FEATURE_NAMES = ["value", "norm_dist", "range_width", "hist_mean", "slope", "n_hist"]


def generate_sample():
    (analyte, sex), (ref_low, ref_high) = random.choice(list(REFERENCE_RANGES.items()))
    mid = (ref_low + ref_high) / 2
    half = (ref_high - ref_low) / 2

    scenario = random.random()

    if scenario < 0.55:
        # Clearly normal: value and history both comfortably inside range.
        norm_dist = np.random.uniform(-0.7, 0.7)
        n_hist = random.choice([0, 1, 2, 3, 4])
        history_norm = [norm_dist + np.random.normal(0, 0.15) for _ in range(n_hist)]
        label = 0

    elif scenario < 0.80:
        # Clearly abnormal: value well outside range, history may or may not be.
        sign = random.choice([-1, 1])
        norm_dist = sign * np.random.uniform(1.2, 3.0)
        n_hist = random.choice([0, 1, 2, 3, 4])
        history_norm = [norm_dist + np.random.normal(0, 0.3) for _ in range(n_hist)]
        label = 1

    else:
        # Borderline-but-trending: value still just inside range, but the
        # recent trend is moving sharply toward/past the edge. This is the
        # case the rule-based flag structurally cannot catch — it only
        # exists for the RF to learn from trend, not just position.
        sign = random.choice([-1, 1])
        norm_dist = sign * np.random.uniform(0.75, 0.98)
        n_hist = random.choice([2, 3, 4])
        # History starts further from the edge and worsens toward norm_dist.
        start = norm_dist - sign * np.random.uniform(0.4, 0.9)
        history_norm = list(np.linspace(start, norm_dist, n_hist) + np.random.normal(0, 0.08, n_hist))
        # Not deterministic — noisy label so the model isn't trivially perfect.
        label = 1 if random.random() < 0.72 else 0

    value = mid + norm_dist * half
    history = [mid + h * half for h in history_norm]

    features = compute_features(value, ref_low, ref_high, history)
    return features, label


def main():
    n_samples = 8000
    X, y = [], []
    for _ in range(n_samples):
        feats, label = generate_sample()
        X.append(feats)
        y.append(label)

    X = np.array(X)
    y = np.array(y)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = RandomForestClassifier(
        n_estimators=150,
        max_depth=8,
        min_samples_leaf=5,
        class_weight="balanced",
        random_state=42,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    print(f"Test set size: {len(y_test)}")
    print(f"Accuracy:  {accuracy_score(y_test, y_pred):.4f}")
    print(f"Precision: {precision_score(y_test, y_pred):.4f}")
    print(f"Recall:    {recall_score(y_test, y_pred):.4f}")
    print(f"F1-score:  {f1_score(y_test, y_pred):.4f}")
    print()
    print("Feature importances:")
    for name, importance in sorted(zip(FEATURE_NAMES, model.feature_importances_), key=lambda x: -x[1]):
        print(f"  {name:15s} {importance:.4f}")

    joblib.dump(model, "model.joblib")
    print("\nSaved model.joblib")


if __name__ == "__main__":
    main()
