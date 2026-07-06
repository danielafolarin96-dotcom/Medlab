"""
POST /api/predict
Body: { "patientId": "...", "analyte": "...", "value": 12.4, "refLow": 12.0, "refHigh": 15.5 }
Header: Authorization: Bearer <the calling clinician's own Supabase access token>

Returns: { "probability": 0.83, "isAbnormal": true, "modelVersion": "rf-v1",
           "featuresUsed": { ... }, "historyPointsUsed": 3 }

Design note: this endpoint is READ-ONLY. It fetches the patient's own prior
results for this analyte (using the caller's forwarded token, so Row Level
Security applies exactly as it does everywhere else in the app — no
service-role key is used here), computes features, and returns a
prediction. It never writes to the database itself; the frontend persists
the result and the ml_prediction_logs entry, same as every other write in
this app going through the authenticated client under RLS.

IMPORTANT: compute_features() below MUST stay identical to the copy in
ml/train_model.py — see that file's docstring for why.
"""

import json
import os
from http.server import BaseHTTPRequestHandler

import joblib
import numpy as np
import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("VITE_SUPABASE_ANON_KEY")
MODEL_VERSION = "rf-v1"

_model = None


def get_model():
    global _model
    if _model is None:
        model_path = os.path.join(os.path.dirname(__file__), "model.joblib")
        _model = joblib.load(model_path)
    return _model


def compute_features(value, ref_low, ref_high, history):
    """Kept identical to ml/train_model.py's compute_features(). Do not
    change one without changing the other and retraining."""
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


def fetch_history(patient_id, analyte, caller_token):
    """Last up to 4 prior results for this patient+analyte, oldest first.
    Uses the caller's own token, so this only ever returns what RLS would
    already let that clinician see through the normal app UI."""
    url = f"{SUPABASE_URL}/rest/v1/lab_results"
    params = {
        "patient_id": f"eq.{patient_id}",
        "analyte": f"eq.{analyte}",
        "select": "value,test_date",
        "order": "test_date.desc",
        "limit": "4",
    }
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {caller_token}",
    }
    resp = requests.get(url, params=params, headers=headers, timeout=8)
    resp.raise_for_status()
    rows = resp.json()
    values = [float(r["value"]) for r in rows]
    values.reverse()  # oldest first, matching training
    return values


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-type", "application/json")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if not SUPABASE_URL or not SUPABASE_ANON_KEY:
            return self._send_json(500, {"error": "Server misconfigured: missing Supabase URL/anon key"})

        auth_header = self.headers.get("Authorization", "")
        caller_token = auth_header.replace("Bearer ", "").strip()
        if not caller_token:
            return self._send_json(401, {"error": "Missing authorization token"})

        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            return self._send_json(400, {"error": "Invalid JSON body"})

        patient_id = body.get("patientId")
        analyte = body.get("analyte")
        value = body.get("value")
        ref_low = body.get("refLow")
        ref_high = body.get("refHigh")

        if not all([patient_id, analyte]) or value is None or ref_low is None or ref_high is None:
            return self._send_json(400, {"error": "patientId, analyte, value, refLow, refHigh are required"})

        try:
            value = float(value)
            ref_low = float(ref_low)
            ref_high = float(ref_high)
        except (TypeError, ValueError):
            return self._send_json(400, {"error": "value, refLow, refHigh must be numeric"})

        try:
            history = fetch_history(patient_id, analyte, caller_token)
        except requests.exceptions.RequestException as e:
            return self._send_json(502, {"error": f"Could not fetch patient history: {e}"})

        features = compute_features(value, ref_low, ref_high, history)

        try:
            model = get_model()
            probability = float(model.predict_proba([features])[0][1])
        except Exception as e:
            return self._send_json(500, {"error": f"Model inference failed: {e}"})

        feature_names = ["value", "norm_dist", "range_width", "hist_mean", "slope", "n_hist"]
        features_used = dict(zip(feature_names, features))

        return self._send_json(200, {
            "probability": round(probability, 4),
            "isAbnormal": probability >= 0.5,
            "modelVersion": MODEL_VERSION,
            "featuresUsed": features_used,
            "historyPointsUsed": len(history),
        })
