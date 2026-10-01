"""
OceanEmbed inference engine.

Loads the OceanEmbed model and ocean mask at import time (once at server startup).
Exposes:
  - model          : OceanEmbed in eval mode
  - surface_mask   : np.ndarray (100, 240) binary 0/1
  - NORM_STATS     : dict of per-variable mean/std
  - DEPTH_LEVELS   : list of 15 depth values in metres
  - run_inference  : function (x_history, x_target) → np.ndarray (15, 100, 240) in real °C
"""
import os
import logging
import time

import numpy as np
import torch
import xarray as xr

from app.model import OceanEmbed

logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
_BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

_CHECKPOINT_CANDIDATES = [
    os.path.join(_BASE, "checkpoints", "oceanembed_epoch_7.pth"),
    "/mnt/Data/SIH 2k26/models/evaluation/checkpoints/oceanembed_epoch_7.pth",
]

_MASK_CANDIDATES = [
    "/mnt/Data/SIH 2k26/models/evaluation/data/ocean_mask_3d.nc",
    os.path.join(_BASE, "data", "ocean_mask_3d.nc"),
]

# ── Normalization stats (z-score per feature, from normalization_stats.json) ──
NORM_STATS: dict = {
    "analysed_sst": {"mean": 28.171791076660156, "std": 1.7956781387329102},
    "sos":          {"mean": 34.701255798339844,  "std": 1.9610856771469116},
    "sla":          {"mean": 0.058311380445957184, "std": 0.09984976798295975},
    "uwnd":         {"mean": 1.2184956073760986,   "std": 4.682363033294678},
    "vwnd":         {"mean": 0.29616203904151917,  "std": 4.391159534454346},
    "u":            {"mean": 0.013475114479660988,  "std": 0.22300511598587036},
    "v":            {"mean": 0.011245391331613064,  "std": 0.2042849063873291},
    "thetao":       {"mean": 21.2752742767334,      "std": 7.5230841636657715},
}

DEPTH_LEVELS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]

# ── Load surface mask ─────────────────────────────────────────────────────────
def _load_surface_mask() -> np.ndarray:
    for p in _MASK_CANDIDATES:
        if os.path.exists(p):
            ds = xr.open_dataset(p)
            # depth index 0 → surface level
            mask = ds["ocean_mask"].values[0].astype(np.float32)  # (100, 240)
            ds.close()
            logger.info(f"Surface mask loaded from {p} — shape {mask.shape}")
            return mask
    raise FileNotFoundError(f"Ocean mask not found in any of: {_MASK_CANDIDATES}")


# ── Load model ────────────────────────────────────────────────────────────────
def _load_model() -> OceanEmbed:
    net = OceanEmbed(in_channels=8, mixer_branches=16, lstm_hidden=32,
                     target_channels=8, out_depths=15)
    for p in _CHECKPOINT_CANDIDATES:
        if os.path.exists(p):
            state_dict = torch.load(p, map_location="cpu", weights_only=False)
            # Strip DataParallel 'module.' prefix if present
            clean_sd = {
                (k[7:] if k.startswith("module.") else k): v
                for k, v in state_dict.items()
            }
            net.load_state_dict(clean_sd)
            net.eval()
            logger.info(f"OceanEmbed loaded from {p}")
            return net
    raise FileNotFoundError(f"Checkpoint not found in any of: {_CHECKPOINT_CANDIDATES}")


# ── Module-level singletons (loaded once at import / server startup) ──────────
logger.info("Loading OceanEmbed model and surface mask...")
try:
    model: OceanEmbed = _load_model()
    surface_mask: np.ndarray = _load_surface_mask()
    _model_loaded = True
    logger.info("Model and mask ready.")
except Exception as exc:
    logger.error(f"Failed to load model/mask: {exc}")
    model = None
    surface_mask = None
    _model_loaded = False


# ── Inference function ────────────────────────────────────────────────────────
def run_inference(
    x_history: np.ndarray,   # (10, 8, 100, 240) — normalised, mask appended
    x_target: np.ndarray,    # (8, 100, 240)      — normalised, mask appended
) -> tuple[np.ndarray, float]:
    """Run OceanEmbed forward pass.

    Returns:
        pred_celsius : np.ndarray (15, 100, 240) in real °C, land pixels = NaN
        latency_ms   : float
    """
    if model is None:
        raise RuntimeError("Model not loaded.")

    t0 = time.perf_counter()

    hist_t = torch.from_numpy(x_history).unsqueeze(0).float()   # (1, 10, 8, 100, 240)
    tgt_t  = torch.from_numpy(x_target).unsqueeze(0).float()    # (1, 8, 100, 240)

    with torch.no_grad():
        pred_norm = model(hist_t, tgt_t)   # (1, 15, 100, 240)

    latency_ms = (time.perf_counter() - t0) * 1000.0

    # Un-normalise: z → real °C
    thetao_mean = NORM_STATS["thetao"]["mean"]
    thetao_std  = NORM_STATS["thetao"]["std"]
    pred_celsius = pred_norm.squeeze(0).numpy() * thetao_std + thetao_mean  # (15, 100, 240)

    # Mask land pixels (surface_mask == 0) → NaN
    if surface_mask is not None:
        land = surface_mask == 0  # (100, 240)
        pred_celsius[:, land] = np.nan

    return pred_celsius, latency_ms
