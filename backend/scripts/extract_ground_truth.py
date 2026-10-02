#!/usr/bin/env python3
"""
Extract and pre-cache GLORYS and INCOIS ARGO ground truth for all 10 demo target dates.
CRITICAL: ARGO grid is offset by +0.125° from the model/GLORYS grid.
          Must use nearest-neighbour matching by coordinate, NOT by raw array index.

Saves:
- backend/app/ground_truth_glorys.npz  (GLORYS 3D field in real °C, float32)
- backend/app/ground_truth_meta.json   (ARGO floats with properly collocated model+GLORYS profiles)
"""
import json
from pathlib import Path
import numpy as np
import pandas as pd
import xarray as xr

BASE_DIR = Path("/mnt/Data/SIH 2k26")
EVAL_DIR = BASE_DIR / "models" / "evaluation" / "data"
OUT_DIR  = BASE_DIR / "backend" / "app"

DEMO_DATES = [
    {"target_date": "2023-10-18", "season": "Autumn Post-Monsoon (High ARGO Density, Oct 2023)"},
    {"target_date": "2022-09-23", "season": "Late Summer Monsoon (High ARGO Density, Sep 2022)"},
    {"target_date": "2022-01-11", "season": "Winter Monsoon (Jan 2022)"},
    {"target_date": "2022-04-11", "season": "Spring Pre-Monsoon (Apr 2022)"},
    {"target_date": "2022-07-11", "season": "Southwest Summer Monsoon (Jul 2022)"},
    {"target_date": "2022-10-11", "season": "Post-Monsoon Transition (Oct 2022)"},
    {"target_date": "2023-02-11", "season": "Late Winter Stratification (Feb 2023)"},
    {"target_date": "2023-05-11", "season": "Pre-Monsoon Peak Warming (May 2023)"},
    {"target_date": "2023-08-11", "season": "Mid-Monsoon Wind Mixing (Aug 2023)"},
    {"target_date": "2023-11-11", "season": "Northeast Monsoon (Nov 2023)"},
    {"target_date": "2024-03-11", "season": "Spring Warming (Mar 2024)"},
    {"target_date": "2024-10-11", "season": "Autumn Post-Monsoon (Oct 2024)"},
]

DEPTH_LEVELS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]

# Model / GLORYS grid (0.25° resolution starting at 5.0°N, 45.0°E)
MODEL_LATS = np.array([5.0 + i * 0.25 for i in range(100)])
MODEL_LONS = np.array([45.0 + i * 0.25 for i in range(240)])


def nearest_model_idx(lat_val: float, lon_val: float):
    """
    Find the nearest index in the MODEL grid for a given ARGO float coordinate.
    ARGO grid is offset +0.125° so we cannot use ARGO's array index directly.
    """
    lat_i = int(np.argmin(np.abs(MODEL_LATS - lat_val)))
    lon_i = int(np.argmin(np.abs(MODEL_LONS - lon_val)))
    return lat_i, lon_i


print("Opening GLORYS, ARGO, and 3D Mask datasets...")
ds_g = xr.open_dataset(EVAL_DIR / "target_normalized.nc")
ds_a = xr.open_dataset(EVAL_DIR / "incois_argo_thetao_2022_2024_eval.nc")
ds_m = xr.open_dataset(EVAL_DIR / "ocean_mask_3d.nc")

mask_3d = ds_m["ocean_mask"].values  # (15, 100, 240)

# ARGO native grid coordinates
argo_lats = ds_a["latitude"].values   # starts at 5.125
argo_lons = ds_a["longitude"].values  # starts at 45.125

g_times = pd.to_datetime(ds_g["time"].values).strftime("%Y-%m-%d").tolist()
a_times = pd.to_datetime(ds_a["time"].values).strftime("%Y-%m-%d").tolist()

# Also load GLORYS native lats/lons for nearest-neighbour from GLORYS side
glorys_lats = ds_g["latitude"].values
glorys_lons = ds_g["longitude"].values

glorys_dict = {}
meta_dict   = {}

for item in DEMO_DATES:
    dt = item["target_date"]
    print(f"\nProcessing {dt} ({item['season']})...")

    g_idx = g_times.index(dt)
    a_idx = a_times.index(dt)

    # ── 1. GLORYS: extract, un-normalize, apply 3D bathymetry mask ────────────
    g_slice_norm = ds_g["thetao"].isel(time=g_idx).values  # (15, 100, 240)
    g_slice_c    = g_slice_norm * 7.5230841636657715 + 21.2752742767334
    g_slice_c[mask_3d == 0] = np.nan
    glorys_dict[dt] = g_slice_c.astype(np.float32)

    # ── 2. ARGO: find observation cells (in ARGO's own grid) ──────────────────
    a_thetao = ds_a["thetao"].isel(time=a_idx).values        # (15, 100, 240) real °C
    a_mask   = ds_a["argo_obs_mask"].isel(time=a_idx).values # (15, 100, 240) binary

    # Cells where at least 1 depth has a real ARGO observation
    obs_any_depth = np.any(a_mask == 1, axis=0)  # (100, 240)
    argo_lat_idxs, argo_lon_idxs = np.where(obs_any_depth)

    floats = []
    for fid, (a_li, a_loi) in enumerate(zip(argo_lat_idxs, argo_lon_idxs)):
        # Physical coordinates from ARGO's native grid
        f_lat = float(argo_lats[a_li])
        f_lon = float(argo_lons[a_loi])

        # ARGO profile (real °C, keep only observed depths)
        argo_profile = []
        for d_i, d_val in enumerate(DEPTH_LEVELS):
            if a_mask[d_i, a_li, a_loi] == 1:
                t_val = float(a_thetao[d_i, a_li, a_loi])
                if not np.isnan(t_val):
                    argo_profile.append({"depth": int(d_val), "temp": round(t_val, 3)})

        if not argo_profile:
            continue

        # ── CRITICAL: nearest-neighbour colocation to MODEL/GLORYS grid ──────
        # ARGO grid offset = +0.125°; use coordinate matching, not array index.
        m_li, m_loi = nearest_model_idx(f_lat, f_lon)
        matched_lat = float(MODEL_LATS[m_li])
        matched_lon = float(MODEL_LONS[m_loi])
        coord_err_lat = abs(f_lat - matched_lat)
        coord_err_lon = abs(f_lon - matched_lon)

        # GLORYS profile at the collocated model-grid cell
        glorys_profile = []
        for d_i, d_val in enumerate(DEPTH_LEVELS):
            gv = float(g_slice_c[d_i, m_li, m_loi])
            if not np.isnan(gv):
                glorys_profile.append({"depth": int(d_val), "temp": round(gv, 3)})

        floats.append({
            "float_id":      fid + 1,
            # Physical coordinates (ARGO native, for map pins)
            "lat":           round(f_lat, 3),
            "lon":           round(f_lon, 3),
            # Nearest-neighbour MODEL/GLORYS grid indices (for prediction extraction)
            "lat_idx":       m_li,
            "lon_idx":       m_loi,
            "matched_lat":   round(matched_lat, 3),
            "matched_lon":   round(matched_lon, 3),
            "coloc_err_deg": round(max(coord_err_lat, coord_err_lon), 4),
            "obs_count":     len(argo_profile),
            "surface_temp":  argo_profile[0]["temp"] if argo_profile else None,
            "argo_profile":  argo_profile,
            "glorys_profile": glorys_profile,   # collocated GLORYS at model-grid cell
        })

    print(f"  Extracted {len(floats)} ARGO floats | max coloc error: "
          f"{max(f['coloc_err_deg'] for f in floats):.4f}°" if floats else "  No floats found")

    meta_dict[dt] = {
        "target_date":     dt,
        "season":          item["season"],
        "argo_float_count": len(floats),
        "argo_floats":     floats,
        "summary": {
            "glorys_surface_min": round(float(np.nanmin(g_slice_c[0])),  2),
            "glorys_surface_max": round(float(np.nanmax(g_slice_c[0])),  2),
            "glorys_deep_min":    round(float(np.nanmin(g_slice_c[14])), 2),
        }
    }

# ── Save GLORYS 3D cache ───────────────────────────────────────────────────
npz_path = OUT_DIR / "ground_truth_glorys.npz"
np.savez_compressed(npz_path, **glorys_dict)
print(f"\nSaved GLORYS 3D cache → {npz_path} ({npz_path.stat().st_size/(1024*1024):.2f} MB)")

# ── Save ARGO float soundings metadata ────────────────────────────────────
json_path = OUT_DIR / "ground_truth_meta.json"
with open(json_path, "w") as f:
    json.dump(meta_dict, f, separators=(",", ":"))
print(f"Saved ARGO metadata    → {json_path} ({json_path.stat().st_size/1024:.1f} KB)")

print("\n=== Colocation summary ===")
for dt, meta in meta_dict.items():
    n = meta["argo_float_count"]
    if n:
        max_err = max(f["coloc_err_deg"] for f in meta["argo_floats"])
        print(f"  {dt}: {n} floats | max coloc Δ = {max_err:.4f}°")
    else:
        print(f"  {dt}: 0 floats")
