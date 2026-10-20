"""Flask API for the churn model.

Run:  python app.py
Needs churn_finder_artifacts.pkl in the same folder as this file.
"""
from pathlib import Path

import joblib
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

ARTIFACTS = joblib.load(Path(__file__).resolve().parent / "churn_finder_artifacts.pkl")
model = ARTIFACTS["model"]
scaler = ARTIFACTS["scaler"]
label_encoder = ARTIFACTS["label_encoder"]
feature_columns = list(ARTIFACTS["feature_columns"])
scale_columns = list(ARTIFACTS["scale_columns"])

# Fields the web form sends
NUMERIC = ["tenure", "MonthlyCharges", "TotalCharges", "SeniorCitizen"]
CATEGORICAL = [
    "gender", "Partner", "Dependents", "PhoneService", "MultipleLines",
    "InternetService", "OnlineSecurity", "OnlineBackup", "DeviceProtection",
    "TechSupport", "StreamingTV", "StreamingMovies", "Contract",
]


def build_features(payload: dict) -> pd.DataFrame:
    """Turn the raw form values into the exact columns the model was trained on."""
    missing = [k for k in NUMERIC + CATEGORICAL if k not in payload]
    if missing:
        raise ValueError("Missing fields: " + ", ".join(missing))

    raw = pd.DataFrame([payload])
    for col in NUMERIC:
        raw[col] = pd.to_numeric(raw[col], errors="raise")

    # One-hot encode, then line the columns up with training
    encoded = pd.get_dummies(raw, columns=CATEGORICAL)
    encoded = encoded.reindex(columns=feature_columns, fill_value=0)

    encoded[scale_columns] = scaler.transform(encoded[scale_columns])
    return encoded.astype(float)


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.post("/predict")
def predict():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Send a JSON object."}), 400
    try:
        features = build_features(payload)
    except (ValueError, KeyError) as exc:
        return jsonify({"error": str(exc)}), 400

    pred = model.predict(features)[0]
    label = str(label_encoder.inverse_transform([pred])[0])   # "Yes" or "No"
    churn = label.strip().lower() == "yes"

    return jsonify({"churn": churn, "label": label})


if __name__ == "__main__":
    app.run(debug=True, port=5000)