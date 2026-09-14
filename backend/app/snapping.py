"""Nearest coordinate snapping and regression for boundary values (lat=30, lon=105)."""
from __future__ import annotations

import math
from datetime import date
from typing import Iterable

from . import database

# Snapped targets for upper boundary limits:
SNAP_LAT_TARGET = 29.75
SNAP_LON_TARGET = 104.75


def is_boundary_coordinate(lat: float, lon: float) -> bool:
    """Return True if coordinate is at or beyond boundary limits (specifically lat=30.0 or lon=105.0)."""
    return (
        math.isclose(lat, 30.0, abs_tol=1e-3)
        or math.isclose(lon, 105.0, abs_tol=1e-3)
        or lat > 29.75
        or lon > 104.75
    )


def snap_boundary_coordinate(lat: float, lon: float) -> tuple[float, float]:
    """Snap lat=30 to 29.75 and lon=105 to 104.75."""
    snapped_lat = SNAP_LAT_TARGET if (math.isclose(lat, 30.0, abs_tol=1e-3) or lat > 29.75) else lat
    snapped_lon = SNAP_LON_TARGET if (math.isclose(lon, 105.0, abs_tol=1e-3) or lon > 104.75) else lon
    return snapped_lat, snapped_lon


def get_boundary_snapped_profile(
    lat: float,
    lon: float,
    requested_date: date,
    depths: Iterable[int] | None = None,
) -> tuple[list[dict], dict | None]:
    """
    Handle coordinates requiring boundary snapping (lat=30, lon=105):
    1. First snap 30 -> 29.75 and 105 -> 104.75.
    2. If (snapped_lat, snapped_lon) has data in DB, return its profile directly.
    3. If not (e.g. land points), fetch the 5 nearest ocean coordinates
       and compute inverse-distance-weighted regression output across the 5 points.
    """
    target_lat, target_lon = snap_boundary_coordinate(lat, lon)

    # 1. Try direct lookup at snapped coordinates
    direct_profile = database.get_historical_profile(target_lat, target_lon, requested_date, depths)
    if direct_profile:
        return direct_profile, {
            "snapped_lat": target_lat,
            "snapped_lon": target_lon,
            "method": "grid_snap",
        }

    # 2. If no data exists (e.g. land point), use regression output of last 5 nearest ocean values
    neighbors = database.get_nearest_profiles(target_lat, target_lon, requested_date, limit=5)
    if not neighbors:
        return [], None

    # If the closest neighbor is an exact match or only 1 neighbor available
    if len(neighbors) == 1 or neighbors[0][2] < 1e-6:
        n_lat, n_lon, _, prof = neighbors[0]
        if depths is not None:
            depth_set = set(depths)
            prof = [p for p in prof if p["depth_m"] in depth_set]
        return prof, {
            "snapped_lat": n_lat,
            "snapped_lon": n_lon,
            "method": "nearest_neighbor",
        }

    # Inverse Distance Weighting (IDW) regression across the 5 nearest coordinates
    weights = []
    for _, _, dist_sq, _ in neighbors:
        dist = math.sqrt(max(dist_sq, 1e-8))
        weights.append(1.0 / (dist ** 2))
    total_weight = sum(weights)
    norm_weights = [w / total_weight for w in weights]

    depth_temps: dict[int, float] = {}
    depth_weights: dict[int, float] = {}
    for i, (_, _, _, prof) in enumerate(neighbors):
        w = norm_weights[i]
        for item in prof:
            d = item["depth_m"]
            depth_temps[d] = depth_temps.get(d, 0.0) + w * item["temperature_c"]
            depth_weights[d] = depth_weights.get(d, 0.0) + w

    regressed_profile = []
    for d in sorted(depth_temps.keys()):
        if depths is not None and d not in depths:
            continue
        w_sum = depth_weights.get(d, 1.0)
        avg_temp = round(depth_temps[d] / w_sum, 4)
        regressed_profile.append({"depth_m": d, "temperature_c": avg_temp})

    return regressed_profile, {
        "snapped_lat": neighbors[0][0],
        "snapped_lon": neighbors[0][1],
        "method": "5_neighbor_regression",
        "reference_points": [{"lat": n[0], "lon": n[1]} for n in neighbors],
    }
