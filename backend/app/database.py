from __future__ import annotations

import os
from datetime import date
from pathlib import Path
from typing import Generator, Iterable

import numpy as np
import psycopg
from dotenv import load_dotenv

from .constants import (
    LAT_MAX, LAT_MIN, LATITUDES,
    LON_MAX, LON_MIN, LONGITUDES,
    NUM_DEPTHS, NUM_LATS, NUM_LONS, STANDARD_DEPTHS,
)

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

_cube_cache: dict[date, np.ndarray] = {}


def _conn() -> psycopg.Connection:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not configured.")
    return psycopg.connect(url)


def check_connection() -> None:
    with _conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT 1")


def get_available_dates() -> tuple[date | None, date | None]:
    with _conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT MIN(date), MAX(date) FROM ocean_temperature_output")
        return cur.fetchone()


def get_distinct_available_dates() -> list[date]:
    with _conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT DISTINCT date FROM ocean_temperature_output ORDER BY date")
        return [row[0] for row in cur.fetchall()]


def get_historical_profile(lat: float, lon: float, requested_date: date, depths: Iterable[int] | None = None) -> list[dict]:
    sql = "SELECT depth_m, temperature_c FROM ocean_temperature_output WHERE date = %s AND latitude = %s AND longitude = %s"
    params: list[object] = [requested_date, lat, lon]
    if depths is not None:
        sql += " AND depth_m = ANY(%s)"
        params.append(list(depths))
    sql += " ORDER BY depth_m ASC"
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(sql, params)
        return [{"depth_m": row[0], "temperature_c": row[1]} for row in cur.fetchall()]


def get_nearest_profiles(target_lat: float, target_lon: float, requested_date: date, limit: int = 5) -> list[tuple[float, float, float, list[dict]]]:
    """Return profiles for the nearest `limit` coordinates on requested_date."""
    sql_full = """
        SELECT latitude, longitude, ((latitude - %s)^2 + (longitude - %s)^2) AS dist_sq
        FROM ocean_temperature_output WHERE date = %s
        GROUP BY latitude, longitude HAVING COUNT(depth_m) >= 15
        ORDER BY dist_sq ASC LIMIT %s
    """
    sql_any = """
        SELECT latitude, longitude, ((latitude - %s)^2 + (longitude - %s)^2) AS dist_sq
        FROM ocean_temperature_output WHERE date = %s
        GROUP BY latitude, longitude ORDER BY dist_sq ASC LIMIT %s
    """
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(sql_full, [target_lat, target_lon, requested_date, limit])
        coords = [(r[0], r[1], r[2]) for r in cur.fetchall()]
        if not coords:
            cur.execute(sql_any, [target_lat, target_lon, requested_date, limit])
            coords = [(r[0], r[1], r[2]) for r in cur.fetchall()]
            if not coords:
                return []
        results = []
        for n_lat, n_lon, dist_sq in coords:
            cur.execute(
                "SELECT depth_m, temperature_c FROM ocean_temperature_output WHERE date = %s AND latitude = %s AND longitude = %s ORDER BY depth_m ASC",
                [requested_date, n_lat, n_lon],
            )
            profile = [{"depth_m": r[0], "temperature_c": r[1]} for r in cur.fetchall()]
            if profile:
                results.append((n_lat, n_lon, dist_sq, profile))
        return results


def _load_cube(requested_date: date) -> np.ndarray | None:
    """Fetch all rows for a date and build a (15, 101, 241) float16 array. Result is cached."""
    if requested_date in _cube_cache:
        return _cube_cache[requested_date]

    with _conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT depth_m, latitude, longitude, temperature_c FROM ocean_temperature_output WHERE date = %s", [requested_date])
        rows = cur.fetchall()
    if not rows:
        return None

    depth_idx = {d: i for i, d in enumerate(STANDARD_DEPTHS)}
    lat_idx   = {lat: i for i, lat in enumerate(LATITUDES)}
    lon_idx   = {lon: i for i, lon in enumerate(LONGITUDES)}

    cube = np.full((NUM_DEPTHS, NUM_LATS, NUM_LONS), np.nan, dtype=np.float16)
    for d, lat, lon, temp in rows:
        di = depth_idx.get(int(d))
        li = lat_idx.get(round(float(lat), 2))
        lo = lon_idx.get(round(float(lon), 2))
        if di is not None and li is not None and lo is not None:
            cube[di, li, lo] = temp

    # Fill boundary rows from neighbours where missing
    cube[:, 100, :] = np.where(np.isnan(cube[:, 100, :]), cube[:, 99, :], cube[:, 100, :])
    cube[:, :, 240] = np.where(np.isnan(cube[:, :, 240]), cube[:, :, 239], cube[:, :, 240])

    _cube_cache[requested_date] = cube
    return cube


def _to_rows(slice_f16: np.ndarray) -> list[list[float | None]]:
    return [[None if (isinstance(v, float) and v != v) else v for v in row] for row in slice_f16.tolist()]


def stream_historical_cube(
    requested_date: date,
    lat_min: float = LAT_MIN,
    lat_max: float = LAT_MAX,
    lon_min: float = LON_MIN,
    lon_max: float = LON_MAX,
    depths: Iterable[int] | None = None,
) -> Generator[dict, None, None]:
    """Yield NDJSON-ready dicts depth-by-depth.

    Chunk sequence:
        {"type": "metadata", "date", "depths", "latitudes", "longitudes", "shape", "dtype"}
        {"type": "depth_slice", "depth_index", "depth_m", "values"}  × N depths
        {"type": "complete", "total_depth_slices"}
    """
    cube = _load_cube(requested_date)
    if cube is None:
        return

    if depths is None:
        sel_depths, depth_idx = STANDARD_DEPTHS, list(range(NUM_DEPTHS))
    else:
        req = set(depths)
        sel_depths = [d for d in STANDARD_DEPTHS if d in req]
        depth_idx  = [i for i, d in enumerate(STANDARD_DEPTHS) if d in req]

    lat_idx = [i for i, lat in enumerate(LATITUDES)  if lat_min <= lat <= lat_max]
    lon_idx = [i for i, lon in enumerate(LONGITUDES) if lon_min <= lon <= lon_max]
    sel_lats = [LATITUDES[i]  for i in lat_idx]
    sel_lons = [LONGITUDES[i] for i in lon_idx]

    if not depth_idx or not lat_idx or not lon_idx:
        return

    yield {
        "type": "metadata",
        "date": str(requested_date),
        "depths": sel_depths,
        "latitudes": sel_lats,
        "longitudes": sel_lons,
        "shape": [len(depth_idx), len(sel_lats), len(sel_lons)],
        "dtype": "float16",
    }

    lat_arr = np.array(lat_idx)
    lon_arr = np.array(lon_idx)
    for out_i, d_i in enumerate(depth_idx):
        yield {
            "type": "depth_slice",
            "depth_index": out_i,
            "depth_m": sel_depths[out_i],
            "values": _to_rows(cube[d_i][np.ix_(lat_arr, lon_arr)]),
        }

    yield {"type": "complete", "total_depth_slices": len(depth_idx)}
