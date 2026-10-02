"""
OceanEmbed NetCDF preprocessor.

preprocess_nc(nc_path, surface_mask, norm_stats)
  → (x_history: np.ndarray (10,8,100,240),
     x_target:  np.ndarray (8,100,240))

Pipeline:
  1. Open NetCDF with xarray
  2. Validate variables, time dim (11), spatial shape (100×240), lat/lon range
  3. Stack 7 channels into (11, 7, 100, 240) in canonical order
  4. Apply surface mask: NaN → 0 on land pixels for all features
  5. Z-score normalise each of 7 channels
  6. Append mask as 8th channel → (11, 8, 100, 240)
  7. Split: history [0:10], target [10]
"""
from __future__ import annotations

import logging
import warnings

import numpy as np
import xarray as xr
from fastapi import HTTPException

logger = logging.getLogger(__name__)

# Canonical variable order (7 feature channels)
CHANNEL_ORDER = ["analysed_sst", "sos", "sla", "uwnd", "vwnd", "u", "v"]

# Expected grid
EXPECTED_LAT  = 100
EXPECTED_LON  = 240
LAT_MIN, LAT_MAX = 5.0, 29.75
LON_MIN, LON_MAX = 45.0, 104.75
LAT_TOL = 0.30   # tolerance in degrees for range check
LON_TOL = 0.30


def preprocess_nc(
    nc_path: str,
    surface_mask: np.ndarray,   # (100, 240) binary float32
    norm_stats: dict,
) -> tuple[np.ndarray, np.ndarray]:
    """Parse and normalise an 11-day NetCDF file for OceanEmbed inference.

    Raises HTTPException(400) with a clear message on any validation failure.
    """
    warnings.filterwarnings("ignore")

    # ── 1. Validate File Format & Open ────────────────────────────────────────
    try:
        with open(nc_path, "rb") as f_head:
            header = f_head.read(64)
            if b"<html" in header.lower() or b"<!doctype" in header.lower():
                raise HTTPException(
                    400,
                    "Invalid file format: received an HTML web page instead of a binary NetCDF (.nc) file. "
                    "This occurs when demo files are missing from the frontend deployment (404 rewrite). "
                    "Please ensure demo NetCDF files are pushed to git and deployed on Vercel."
                )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, f"Unable to read file: {exc}")

    ds = None
    last_err = None
    for eng in ["netcdf4", "h5netcdf", "scipy", None]:
        try:
            if eng:
                ds = xr.open_dataset(nc_path, engine=eng)
            else:
                ds = xr.open_dataset(nc_path)
            if ds is not None:
                break
        except Exception as e:
            last_err = e

    if ds is None:
        raise HTTPException(400, f"Cannot open NetCDF file: {last_err}")

    # ── 2. Validate variables ─────────────────────────────────────────────────
    missing = [v for v in CHANNEL_ORDER if v not in ds.data_vars]
    if missing:
        raise HTTPException(
            400,
            f"Missing variables in uploaded file: {missing}. "
            f"Required: {CHANNEL_ORDER}. Found: {list(ds.data_vars)}"
        )

    # ── 3. Validate time dimension ────────────────────────────────────────────
    if "time" not in ds.dims:
        raise HTTPException(400, "NetCDF file must have a 'time' dimension.")
    n_time = ds.dims["time"]
    if n_time != 11:
        raise HTTPException(
            400,
            f"Expected exactly 11 time steps (10 history + 1 target day). "
            f"Got {n_time} time steps."
        )

    # ── 4. Validate spatial dimensions ────────────────────────────────────────
    lat_name = "latitude" if "latitude" in ds.dims else ("lat" if "lat" in ds.dims else None)
    lon_name = "longitude" if "longitude" in ds.dims else ("lon" if "lon" in ds.dims else None)

    if lat_name is None or lon_name is None:
        raise HTTPException(400, "NetCDF must have 'latitude'/'longitude' (or 'lat'/'lon') dimensions.")

    n_lat = ds.dims[lat_name]
    n_lon = ds.dims[lon_name]
    if n_lat != EXPECTED_LAT or n_lon != EXPECTED_LON:
        raise HTTPException(
            400,
            f"Spatial grid mismatch. Expected {EXPECTED_LAT}×{EXPECTED_LON} "
            f"(lat×lon). Got {n_lat}×{n_lon}."
        )

    # ── 5. Validate lat/lon range ─────────────────────────────────────────────
    lat_vals = ds[lat_name].values.astype(float)
    lon_vals = ds[lon_name].values.astype(float)

    if (abs(float(lat_vals.min()) - LAT_MIN) > LAT_TOL or
            abs(float(lat_vals.max()) - LAT_MAX) > LAT_TOL):
        raise HTTPException(
            400,
            f"Latitude range must be ~{LAT_MIN}° to {LAT_MAX}°N (North Indian Ocean). "
            f"Got {float(lat_vals.min()):.2f}° to {float(lat_vals.max()):.2f}°."
        )

    if (abs(float(lon_vals.min()) - LON_MIN) > LON_TOL or
            abs(float(lon_vals.max()) - LON_MAX) > LON_TOL):
        raise HTTPException(
            400,
            f"Longitude range must be ~{LON_MIN}° to {LON_MAX}°E. "
            f"Got {float(lon_vals.min()):.2f}° to {float(lon_vals.max()):.2f}°."
        )

    # ── 6. Stack channels (11, 7, 100, 240) ──────────────────────────────────
    channel_arrays = []
    for var in CHANNEL_ORDER:
        arr = ds[var].values.astype(np.float32)  # (11, lat, lon)
        # Ensure (time, lat, lon) ordering
        if arr.shape != (11, EXPECTED_LAT, EXPECTED_LON):
            try:
                da = ds[var].transpose("time", lat_name, lon_name)
                arr = da.values.astype(np.float32)
            except Exception:
                raise HTTPException(400, f"Cannot reshape variable '{var}' to (11, 100, 240).")
        channel_arrays.append(arr)

    # ── Extract target date (11th time step) ──────────────────────────────────
    target_date = None
    try:
        if "time" in ds.coords and len(ds["time"]) >= 11:
            raw_t = ds["time"].values[10]
            import pandas as pd
            target_date = str(pd.to_datetime(raw_t).strftime("%Y-%m-%d"))
    except Exception as e:
        logger.warning(f"Could not parse target_date from NetCDF time axis: {e}")

    data = np.stack(channel_arrays, axis=1)  # (11, 7, 100, 240)
    ds.close()

    # ── 7. Apply surface mask (land → NaN, exactly like ds.where(official_mask)) ──
    land = (surface_mask == 0)  # (100, 240) boolean
    for c in range(7):
        ch = data[:, c, :, :]
        ch[:, land] = np.nan                 # land pixels → NaN (matching training pipeline)
        data[:, c, :, :] = ch

    # ── 8. Z-score normalise & fillna(0.0) (matching build_validation_features.py) ──
    for c, var in enumerate(CHANNEL_ORDER):
        mean = norm_stats[var]["mean"]
        std  = norm_stats[var]["std"]
        data[:, c, :, :] = (data[:, c, :, :] - mean) / std

    # In training pipeline: ((ds - mean) / std).fillna(0.0)
    # Over land (NaN), (NaN - mean)/std is NaN, then filled with 0.0
    data = np.nan_to_num(data, nan=0.0).astype(np.float32)

    # ── 9. Append mask as 8th channel → (11, 8, 100, 240) ────────────────────
    mask_channel = np.broadcast_to(
        surface_mask[np.newaxis, np.newaxis, :, :],
        (11, 1, EXPECTED_LAT, EXPECTED_LON)
    ).copy().astype(np.float32)
    data = np.concatenate([data, mask_channel], axis=1)  # (11, 8, 100, 240)

    # ── 10. Split history / target ────────────────────────────────────────────
    x_history = data[0:10]   # (10, 8, 100, 240)
    x_target  = data[10]     # (8, 100, 240)

    logger.info(f"Preprocessed: history {x_history.shape}, target {x_target.shape}, target_date={target_date}")
    return x_history, x_target, target_date
