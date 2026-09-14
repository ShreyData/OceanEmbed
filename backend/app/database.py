"""Small, parameterized psycopg data access helpers."""
from __future__ import annotations

import os
from datetime import date
from pathlib import Path
from typing import Iterable

import psycopg
from dotenv import load_dotenv

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
