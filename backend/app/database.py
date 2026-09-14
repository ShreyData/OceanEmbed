"""Small, parameterized psycopg data access helpers."""
from __future__ import annotations

import os
from datetime import date
from pathlib import Path
from typing import Iterable

import numpy as np
import psycopg
from dotenv import load_dotenv

from .constants import (
    LAT_MAX,
    LAT_MIN,
    LATITUDES,
    LON_MAX,
    LON_MIN,
    LONGITUDES,
    NUM_DEPTHS,
    NUM_LATS,
    NUM_LONS,
    STANDARD_DEPTHS,
)

BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env")


def _connection() -> psycopg.Connection:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured")
    return psycopg.connect(database_url)


def check_connection() -> None:
    with _connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT 1")


def get_available_dates() -> tuple[date | None, date | None]:
    with _connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT MIN(date), MAX(date) FROM ocean_temperature_output")
        return cur.fetchone()


def get_distinct_available_dates() -> list[date]:
    with _connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT DISTINCT date FROM ocean_temperature_output ORDER BY date")
        return [row[0] for row in cur.fetchall()]


def get_historical_profile(lat: float, lon: float, requested_date: date, depths: Iterable[int] | None = None) -> list[dict]:
    sql = """
        SELECT depth_m, temperature_c
        FROM ocean_temperature_output
        WHERE date = %s AND latitude = %s AND longitude = %s
    """
    params: list[object] = [requested_date, lat, lon]
    if depths is not None:
        sql += " AND depth_m = ANY(%s)"
        params.append(list(depths))
    sql += " ORDER BY depth_m ASC"
    with _connection() as conn, conn.cursor() as cur:
        cur.execute(sql, params)
        return [{"depth_m": row[0], "temperature_c": row[1]} for row in cur.fetchall()]


def get_mock_profile(lat: float, lon: float, source_date: date) -> list[dict]:
    return get_historical_profile(lat, lon, source_date)


def get_nearest_profiles(target_lat: float, target_lon: float, requested_date: date, limit: int = 5) -> list[tuple[float, float, float, list[dict]]]:
    """Return profiles for the `limit` nearest distinct coordinates to (target_lat, target_lon) on requested_date."""
    # First attempt: find nearest points with full standard depth profiles (15 depth levels)
    sql_full = """
        SELECT latitude, longitude,
               ((latitude - %s)^2 + (longitude - %s)^2) AS dist_sq
        FROM ocean_temperature_output
        WHERE date = %s
        GROUP BY latitude, longitude
        HAVING COUNT(depth_m) >= 15
        ORDER BY dist_sq ASC
        LIMIT %s
    """
    with _connection() as conn, conn.cursor() as cur:
        cur.execute(sql_full, [target_lat, target_lon, requested_date, limit])
        coords = [(row[0], row[1], row[2]) for row in cur.fetchall()]
        if not coords:
            # Fallback without full depth requirement
            cur.execute("""
                SELECT latitude, longitude,
                       ((latitude - %s)^2 + (longitude - %s)^2) AS dist_sq
                FROM ocean_temperature_output
                WHERE date = %s
                GROUP BY latitude, longitude
                ORDER BY dist_sq ASC
                LIMIT %s
            """, [target_lat, target_lon, requested_date, limit])
            coords = [(row[0], row[1], row[2]) for row in cur.fetchall()]
            if not coords:
                return []

        results = []
        for n_lat, n_lon, dist_sq in coords:
            cur.execute("""
                SELECT depth_m, temperature_c
                FROM ocean_temperature_output
                WHERE date = %s AND latitude = %s AND longitude = %s
                ORDER BY depth_m ASC
            """, [requested_date, n_lat, n_lon])
            profile = [{"depth_m": r[0], "temperature_c": r[1]} for r in cur.fetchall()]
            if profile:
                results.append((n_lat, n_lon, dist_sq, profile))
        return results


_cube_cache: dict[date, np.ndarray] = {}


def get_historical_cube_raw(requested_date: date) -> np.ndarray | None:
    """Fetch all records for requested_date and build a (15, 101, 241) float32 numpy array with boundary snapping."""
    if requested_date in _cube_cache:
        return _cube_cache[requested_date]

    sql = """
        SELECT depth_m, latitude, longitude, temperature_c
        FROM ocean_temperature_output
        WHERE date = %s
    """
    with _connection() as conn, conn.cursor() as cur:
        cur.execute(sql, [requested_date])
        rows = cur.fetchall()
        if not rows:
            return None

    depth_to_idx = {d: i for i, d in enumerate(STANDARD_DEPTHS)}
    lat_to_idx = {lat: i for i, lat in enumerate(LATITUDES)}
    lon_to_idx = {lon: i for i, lon in enumerate(LONGITUDES)}

    cube = np.full((NUM_DEPTHS, NUM_LATS, NUM_LONS), np.nan, dtype=np.float32)
    for d, lat, lon, temp in rows:
        d_i = depth_to_idx.get(int(d))
        lat_i = lat_to_idx.get(round(float(lat), 2))
        lon_i = lon_to_idx.get(round(float(lon), 2))
        if d_i is not None and lat_i is not None and lon_i is not None:
            cube[d_i, lat_i, lon_i] = temp

    # Boundary snapping for lat=30.0 and lon=105.0:
    # Snap lat index 100 (30.0) from index 99 (29.75) where available
    cube[:, 100, :] = np.where(np.isnan(cube[:, 100, :]), cube[:, 99, :], cube[:, 100, :])
    # Snap lon index 240 (105.0) from index 239 (104.75) where available
    cube[:, :, 240] = np.where(np.isnan(cube[:, :, 240]), cube[:, :, 239], cube[:, :, 240])

    _cube_cache[requested_date] = cube
    return cube


def get_historical_cube(
    requested_date: date,
    lat_min: float = LAT_MIN,
    lat_max: float = LAT_MAX,
    lon_min: float = LON_MIN,
    lon_max: float = LON_MAX,
    depths: Iterable[int] | None = None,
) -> dict | None:
    cube = get_historical_cube_raw(requested_date)
    if cube is None:
        return None

    # Filter depths
    if depths is None:
        selected_depths = STANDARD_DEPTHS
        depth_indices = list(range(NUM_DEPTHS))
    else:
        req_set = set(depths)
        selected_depths = [d for d in STANDARD_DEPTHS if d in req_set]
        depth_indices = [i for i, d in enumerate(STANDARD_DEPTHS) if d in req_set]

    # Filter latitudes
    lat_indices = [i for i, lat in enumerate(LATITUDES) if lat_min <= lat <= lat_max]
    selected_lats = [LATITUDES[i] for i in lat_indices]

    # Filter longitudes
    lon_indices = [i for i, lon in enumerate(LONGITUDES) if lon_min <= lon <= lon_max]
    selected_lons = [LONGITUDES[i] for i in lon_indices]

    if not depth_indices or not lat_indices or not lon_indices:
        return None

    subcube = cube[np.ix_(depth_indices, lat_indices, lon_indices)]
    values = np.where(np.isnan(subcube), None, np.round(subcube, 2)).tolist()

    return {
        "date": requested_date,
        "dimensions": {
            "depths": selected_depths,
            "latitudes": selected_lats,
            "longitudes": selected_lons,
        },
        "shape": [len(selected_depths), len(selected_lats), len(selected_lons)],
        "values": values,
    }


