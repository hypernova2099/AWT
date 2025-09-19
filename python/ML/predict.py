# ml/predict.py
import sys, json
from pathlib import Path
import numpy as np
import joblib

MODEL_PATH = Path(__file__).parent / "models" / "burnout_model.pkl"
META_PATH  = Path(__file__).parent / "models" / "metadata.json"

FEATURES = [
    "total_coding_hours","idle_ratio","late_night_work",
    "eye_strain_alerts","typing_session_length","break_compliance"
]

def to_level(idx):
    return ["Very Low","Low","Medium","High"][idx]

def probs_to_score(probs):
    # Ensure probs is length 4 (for 4 classes: 0,1,2,3)
    if len(probs) < 4:
        probs = np.pad(probs, (0, 4 - len(probs)), 'constant')
    weights = np.array([0.1, 0.4, 0.7, 1.0])
    return float(np.clip(np.dot(probs, weights) * 100, 0, 100))

def main():
    # read JSON from argv or stdin
    if len(sys.argv) > 1:
        payload = json.loads(sys.argv[1])
    else:
        payload = json.loads(sys.stdin.read() or "{}")

    # default sensible values if missing
    x = [
        float(payload.get("total_coding_hours", 6)),
        float(payload.get("idle_ratio", 0.3)),
        int(payload.get("late_night_work", 0)),
        float(payload.get("eye_strain_alerts", 2)),
        float(payload.get("typing_session_length", 45)),
        float(payload.get("break_compliance", 0.3)),
    ]

    bundle = joblib.load(MODEL_PATH)
    model = bundle["model"]
    scaler = bundle.get("scaler")
    uses_scaler = bundle.get("uses_scaler", False)

    X = np.array(x, dtype=float).reshape(1, -1)
    if uses_scaler and scaler is not None:
        Xs = scaler.transform(X)
    else:
        Xs = X

    probs = model.predict_proba(Xs)[0]
    pred_idx = int(np.argmax(probs))
    score = round(probs_to_score(probs), 1)
    # Map score into categories manually
    if score < 20:
        level = "Very Low"
    elif score < 40:
        level = "Low"
    elif score < 70:
        level = "Medium"
    else:
        level = "High"
    conf  = round(float(np.max(probs)) * 100, 1)

    result = {
        "score": score,
        "risk_level": level,
        "confidence": conf,
        "factors": {
            "totalCodingHours": x[0],
            "idleRatio": round(x[1], 3),
            "lateNightWork": int(x[2]),
            "eyeStrainAlerts": int(x[3]),
            "typingSessionLength": x[4],
            "breakCompliance": round(x[5], 3),
        }
    }
    print(json.dumps(result))

if __name__ == "__main__":
    main()
