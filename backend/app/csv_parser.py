"""Parse long-format CSV surface observations into the dict structure used by PredictionRequest.

Expected CSV columns (header required):
    feature, lat, lon, value

Supported feature names (from constants.SURFACE_FEATURE_NAMES):
    sst_c, sss_psu, sla_m, u_current_ms, v_current_ms, u_wind_ms, v_wind_ms

Rules:
- lat / lon are snapped to the nearest standard grid point (±0.125° tolerance).
- Missing cells stay None (treated as masked / no-observation).
- value can be a float16-range number, empty string, "nan", "null", or "none" → stored as None.
- Unknown feature names and out-of-grid coordinates are silently skipped.
"""
from __future__ import annotations

import csv
import io

from .constants import LATITUDES, LONGITUDES, NUM_LATS, NUM_LONS, SURFACE_FEATURE_NAMES

# Tolerance for snapping a supplied lat/lon to the nearest 0.25° grid point
_SNAP_TOL = 0.125

# Fast lookup: grid value → row/column index
_LAT_TO_IDX: dict[float, int] = {lat: i for i, lat in enumerate(LATITUDES)}
_LON_TO_IDX: dict[float, int] = {lon: i for i, lon in enumerate(LONGITUDES)}

_NULL_STRINGS = {"", "nan", "null", "none", "na", "n/a"}


def _snap_to_grid(value: float, lookup: dict[float, int], step: float = 0.25) -> int | None:
    """Return the index of the nearest grid coordinate, or None if outside tolerance."""
    nearest = round(round(value / step) * step, 2)
    if abs(value - nearest) <= _SNAP_TOL:
        return lookup.get(nearest)
    return None


def parse_long_csv(raw: bytes) -> dict[str, list[list[float | None]]]:
    """Parse raw CSV bytes → surface_observations dict.

    Returns a dict keyed by feature name, each value being a
    NUM_LATS × NUM_LONS nested list (row = latitude, col = longitude).
    Missing cells are None.

    Raises:
        ValueError: if the CSV header is missing required columns.
    """
    text = raw.decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    # Validate header
    if reader.fieldnames is None:
        raise ValueError("CSV appears to be empty — no header found.")
    required_cols = {"feature", "lat", "lon", "value"}
    missing_cols = required_cols - {c.strip().lower() for c in reader.fieldnames}
    if missing_cols:
        raise ValueError(
            f"CSV is missing required column(s): {sorted(missing_cols)}. "
            f"Expected header: feature,lat,lon,value"
        )

    # Pre-allocate: feature → 2-D list of None
    result: dict[str, list[list[float | None]]] = {
        feat: [[None] * NUM_LONS for _ in range(NUM_LATS)]
        for feat in SURFACE_FEATURE_NAMES
    }

    skipped_features: set[str] = set()
    skipped_coords: int = 0

    for row_num, row in enumerate(reader, start=2):  # start=2 because row 1 is the header
        feature = row.get("feature", "").strip()
        if feature not in result:
            skipped_features.add(feature)
            continue

        try:
            lat_val = float(row["lat"])
            lon_val = float(row["lon"])
        except (ValueError, KeyError):
            skipped_coords += 1
            continue

        lat_i = _snap_to_grid(lat_val, _LAT_TO_IDX)
        lon_i = _snap_to_grid(lon_val, _LON_TO_IDX)
        if lat_i is None or lon_i is None:
            skipped_coords += 1
            continue

        raw_val = row.get("value", "").strip().lower()
        value: float | None
        if raw_val in _NULL_STRINGS:
            value = None
        else:
            try:
                value = float(raw_val)
            except ValueError:
                value = None  # malformed → treat as missing

        result[feature][lat_i][lon_i] = value

    return result
