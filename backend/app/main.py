"""
OceanEmbed FastAPI Server

Endpoints:
  GET  /health   — liveness check
  POST /predict  — accept 11-day .nc file, return 3D temperature predictions
"""
import logging
import os
import uuid
from typing import Any

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import inference as _inf
from app.preprocessor import preprocess_nc, CHANNEL_ORDER

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── App setup ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="OceanEmbed Engine API",
    description="Subsurface ocean temperature reconstruction using OceanEmbed v2 (SIH 2026 — INCOIS)",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEPTH_LEVELS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]

# Pre-compute grid coordinates once
_LAT = [round(5.0 + i * 0.25, 2) for i in range(100)]
_LON = [round(45.0 + i * 0.25, 2) for i in range(240)]


def _safe_float(val: Any) -> float | None:
    """Return float or None if nan/inf."""
    try:
        v = float(val)
        return None if (np.isnan(v) or np.isinf(v)) else round(v, 4)
    except Exception:
        return None


def _array_to_json(arr_2d: np.ndarray) -> list:
    """Convert (H, W) numpy array to nested list, replacing NaN with null."""
    result = []
    for row in arr_2d:
        result.append([_safe_float(v) for v in row])
    return result


# ── Health endpoint ────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "model_loaded": _inf._model_loaded,
        "engine": "OceanEmbed-v2",
        "checkpoint": "epoch_7",
        "depth_levels": DEPTH_LEVELS,
        "grid": {"lat_range": [5.0, 29.75], "lon_range": [45.0, 104.75], "shape": [100, 240]},
    }


# ── Predict endpoint ───────────────────────────────────────────────────────────
@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    # ── Validate file type ─────────────────────────────────────────────────
    filename = file.filename or ""
    if not filename.lower().endswith(".nc"):
        raise HTTPException(400, "Only NetCDF (.nc) files are accepted.")

    if not _inf._model_loaded:
        raise HTTPException(503, "Model not loaded. Check server logs.")

    # ── Save to temp file ──────────────────────────────────────────────────
    tmp_path = f"/tmp/oceanembed_{uuid.uuid4().hex}.nc"
    try:
        contents = await file.read()
        if len(contents) == 0:
            raise HTTPException(400, "Uploaded file is empty.")

        with open(tmp_path, "wb") as f_out:
            f_out.write(contents)

        logger.info(f"Received {filename} ({len(contents)/1024:.1f} KB) → {tmp_path}")

        # ── Preprocess ────────────────────────────────────────────────────
        try:
            x_history, x_target = preprocess_nc(
                nc_path=tmp_path,
                surface_mask=_inf.surface_mask,
                norm_stats=_inf.NORM_STATS,
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Preprocessing failed")
            raise HTTPException(400, f"Preprocessing error: {exc}")

        # ── Inference ─────────────────────────────────────────────────────
        try:
            pred_celsius, latency_ms = _inf.run_inference(x_history, x_target)
        except Exception as exc:
            logger.exception("Inference failed")
            raise HTTPException(500, f"Inference error: {exc}")

        # ── Build response ─────────────────────────────────────────────────
        # Summary stats (surface = depth 0, deep = depth 14 at 1000m)
        surface = pred_celsius[0]
        deep    = pred_celsius[14]

        surface_valid = surface[~np.isnan(surface)]
        deep_valid    = deep[~np.isnan(deep)]

        summary = {
            "surface_temp_min": round(float(np.min(surface_valid)), 2) if surface_valid.size else None,
            "surface_temp_max": round(float(np.max(surface_valid)), 2) if surface_valid.size else None,
            "deep_temp_min":    round(float(np.min(deep_valid)), 2)    if deep_valid.size else None,
        }

        # Predictions dict: depth label → 2D list
        predictions = {}
        for idx, depth in enumerate(DEPTH_LEVELS):
            predictions[f"{depth}m"] = _array_to_json(pred_celsius[idx])

        logger.info(f"Inference complete in {latency_ms:.1f} ms")

        return JSONResponse(content={
            "status": "success",
            "latency_ms": round(latency_ms, 2),
            "depth_levels": DEPTH_LEVELS,
            "grid": {"lat": _LAT, "lon": _LON},
            "summary": summary,
            "predictions": predictions,
        })

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Unexpected error in /predict")
        raise HTTPException(500, f"Internal server error: {exc}")
    finally:
        # Always clean up temp file
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
