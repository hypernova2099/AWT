# ml/train.py
import numpy as np
import pandas as pd
import json
import argparse
import joblib
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report

FEATURES = [
    "total_coding_hours", "idle_ratio", "late_night_work",
    "eye_strain_alerts", "typing_session_length", "break_compliance"
]

RNG = np.random.default_rng(42)

def make_synthetic(n=10000):
    total_coding_hours = np.clip(RNG.normal(6, 2, n), 0, 16)
    idle_ratio = RNG.beta(2, 5, n)             # mostly small
    late_night_work = RNG.binomial(1, 0.3, n)  # 30%
    eye_strain_alerts = RNG.poisson(2, n)      # mean 2
    typing_session_length = np.clip(RNG.exponential(45, n), 5, 180)
    break_compliance = np.clip(RNG.beta(3, 2, n), 0, 1)

    X = pd.DataFrame({
        "total_coding_hours": total_coding_hours,
        "idle_ratio": idle_ratio,
        "late_night_work": late_night_work,
        "eye_strain_alerts": eye_strain_alerts,
        "typing_session_length": typing_session_length,
        "break_compliance": break_compliance
    })

    # rule-of-thumb risk function to create labels
    score_raw = (
        (X.total_coding_hours > 8) * 0.30 +
        (X.idle_ratio < 0.2)       * 0.20 +
        (X.late_night_work == 1)   * 0.15 +
        (X.eye_strain_alerts > 5)  * 0.15 +
        (X.typing_session_length > 90) * 0.10 +
        (X.break_compliance < 0.5) * 0.10
    ).astype(float)

    y = np.zeros(n, dtype=int)  # 0,1,2,3 -> Very Low, Low, Medium, High
    y[score_raw > 0.2] = 1   # Low
    y[score_raw > 0.35] = 2  # Medium
    y[score_raw > 0.5] = 3   # High

    return X, y

"""def train_and_eval(model_name="logreg"):
    X, y = make_synthetic()
    print("Unique classes in y:", np.unique(y))  # Add this line
    X_train, X_test, y_train, y_test = train_test_split(
        X.values, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s  = scaler.transform(X_test)

    if model_name == "logreg":
        model = LogisticRegression(max_iter=2000, multi_class="auto", random_state=42)
        model.fit(X_train_s, y_train)
        y_pred = model.predict(X_test_s)
        y_proba = model.predict_proba(X_test_s)
        uses_scaler = True
    elif model_name == "rf":
        model = RandomForestClassifier(
            n_estimators=300, max_depth=None, min_samples_leaf=2, random_state=42
        )
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        y_proba = model.predict_proba(X_test)
        uses_scaler = False
    else:
        raise ValueError("model_name must be logreg or rf")

    acc = accuracy_score(y_test, y_pred)
    print(f"Accuracy: {acc:.3f}")
    print("Confusion matrix:\n", confusion_matrix(y_test, y_pred))
    print("\nReport:\n", classification_report(y_test, y_pred, digits=3))

    # Save
    outdir = Path(__file__).parent / "models"
    outdir.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {"model": model, "scaler": scaler if uses_scaler else None, "uses_scaler": uses_scaler},
        outdir / "burnout_model.pkl"
    )

    meta = {
        "version": "1.0.0",
        "timestamp": int(time.time()),
        "features": [
            "total_coding_hours","idle_ratio","late_night_work",
            "eye_strain_alerts","typing_session_length","break_compliance"
        ],
        "model_type": model_name,
        "train_size": int(len(X)*0.8),
        "test_size": int(len(X)*0.2),
        "accuracy": acc
    }
    (outdir / "metadata.json").write_text(json.dumps(meta, indent=2))
    print(f"Saved model to {outdir/'burnout_model.pkl'} and metadata.json")"""

from sklearn.utils import resample

def train_and_eval(model_name="logreg", balance=False):
    X, y = make_synthetic(n=5000)

    # 🔎 Show class distribution before balancing
    unique, counts = np.unique(y, return_counts=True)
    print("Class distribution (before balancing):")
    for u, c in zip(unique, counts):
        labels = ["Very Low","Low","Medium","High"]
        print(f"  {u} ({labels[u]}): {c}")

    # 🟢 Optional: Balance classes by oversampling minority ones
    if balance:
        df = pd.DataFrame(X)
        df["label"] = y
        max_count = df["label"].value_counts().max()

        balanced = []
        for label in df["label"].unique():
            subset = df[df["label"] == label]
            # resample with replacement to match max_count
            upsampled = resample(
                subset, 
                replace=True, 
                n_samples=max_count, 
                random_state=42
            )
            balanced.append(upsampled)

        df_bal = pd.concat(balanced)
        X = df_bal.drop("label", axis=1).values
        y = df_bal["label"].values

        # 🔎 Show class distribution after balancing
        unique, counts = np.unique(y, return_counts=True)
        print("Class distribution (after balancing):")
        for u, c in zip(unique, counts):
            labels = ["Very Low","Low","Medium","High"]
            print(f"  {u} ({labels[u]}): {c}")
    else:
        X = X.values

    # Split dataset
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s  = scaler.transform(X_test)

    if model_name == "logreg":
        model = LogisticRegression(max_iter=2000, multi_class="auto", random_state=42)
        model.fit(X_train_s, y_train)
        y_pred = model.predict(X_test_s)
        y_proba = model.predict_proba(X_test_s)
        uses_scaler = True
    elif model_name == "rf":
        model = RandomForestClassifier(
            n_estimators=300, max_depth=None, min_samples_leaf=2, random_state=42
        )
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        y_proba = model.predict_proba(X_test)
        uses_scaler = False
    else:
        raise ValueError("model_name must be logreg or rf")

    acc = accuracy_score(y_test, y_pred)
    print(f"Accuracy: {acc:.3f}")
    print("Confusion matrix:\n", confusion_matrix(y_test, y_pred))
    print("\nReport:\n", classification_report(y_test, y_pred, digits=3))

    # Save model + metadata
    outdir = Path(__file__).parent / "models"
    outdir.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {"model": model, "scaler": scaler if uses_scaler else None, "uses_scaler": uses_scaler},
        outdir / "burnout_model.pkl"
    )

    meta = {
        "version": "1.0.0",
        "features": FEATURES,
        "model_type": model_name,
        "train_size": int(len(X)*0.8),
        "test_size": int(len(X)*0.2),
        "accuracy": acc,
        "balanced": balance
    }
    (outdir / "metadata.json").write_text(json.dumps(meta, indent=2))
    print(f"Saved model to {outdir/'burnout_model.pkl'} and metadata.json")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", choices=["logreg","rf"], default="logreg")
    parser.add_argument("--balance", action="store_true", help="Balance classes using oversampling")
    args = parser.parse_args()
    train_and_eval(args.model, args.balance)
