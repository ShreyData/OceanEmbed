"""Parse long-format CSV surface observations into the dict expected by PredictionRequest.

CSV format (header required):
    feature,lat,lon,value

Supported features: sst_c, sss_psu, sla_m, u_current_ms, v_current_ms, u_wind_ms, v_wind_ms
- lat/lon are snapped to the nearest 0.25° grid point (±0.125° tolerance).
- Missing cells stay None. Unknown features and out-of-grid rows are skipped silently.
- value accepts float, empty string, nan, null, none → stored as None.
"""
from __future__ import annotations

import csv
import io

from .constants import LATITUDES, LONGITUDES, NUM_LATS, NUM_LONS, SURFACE_FEATURE_NAMES

_SNAP_TOL = 0.125
_LAT_TO_IDX: dict[float, int] = {lat: i for i, lat in enumerate(LATITUDES)}
_LON_TO_IDX: dict[float, int] = {lon: i for i, lon in enumerate(LONGITUDES)}
_NULL_STRINGS = {"", "nan", "null", "none", "na", "n/a"}


def _snap(value: float, lookup: dict[float, int], step: float = 0.25) -> int | None:
    nearest = round(round(value / step) * step, 2)
    return lookup.get(nearest) if abs(value - nearest) <= _SNAP_TOL else None


def parse_long_csv(raw: bytes) -> dict[str, list[list[float | None]]]:
    """Return surface_observations dict from raw long-format CSV bytes.

    Raises ValueError if required columns are missing.
    """
    reader = csv.DictReader(io.StringIO(raw.decode("utf-8", errors="replace")))

    if reader.fieldnames is None:
        raise ValueError("CSV is empty — no header found.")

    missing = {"feature", "lat", "lon", "value"} - {c.strip().lower() for c in reader.fieldnames}
    if missing:
        raise ValueError(f"CSV is missing required column(s): {sorted(missing)}. Expected: feature,lat,lon,value")

    result: dict[str, list[list[float | None]]] = {
        feat: [[None] * NUM_LONS for _ in range(NUM_LATS)]
        for feat in SURFACE_FEATURE_NAMES
    }

    for row in reader:
        feature = row.get("feature", "").strip()
        if feature not in result:
            continue
        try:
            lat_i = _snap(float(row["lat"]), _LAT_TO_IDX)
            lon_i = _snap(float(row["lon"]), _LON_TO_IDX)
        except (ValueError, KeyError):
            continue
        if lat_i is None or lon_i is None:
            continue

        raw_val = row.get("value", "").strip().lower()
        result[feature][lat_i][lon_i] = None if raw_val in _NULL_STRINGS else (
            float(raw_val) if raw_val else None
        )

    return result
