from __future__ import annotations

from datetime import date

import psycopg
from fastapi import APIRouter, HTTPException, Query

from . import database
from .constants import GRID_STEP, LAT_MAX, LAT_MIN, LON_MAX, LON_MIN, STANDARD_DEPTHS
from .model import NoMockOutputError, run_mock_inference
from .schemas import PredictionRequest

router = APIRouter()


def _parse_depths(depths: str | None) -> list[int] | None:
    if depths is None:
        return None
    try:
        parsed = [int(item.strip()) for item in depths.split(",") if item.strip()]
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="depths must be comma-separated integers.") from exc
    if not parsed or len(parsed) != len(depths.split(",")) or any(value not in STANDARD_DEPTHS for value in parsed):
        raise HTTPException(status_code=422, detail="Each requested depth must be a supported standard depth.")
    return parsed


@router.get("/health")
def health() -> dict:
    try:
        database.check_connection()
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable.") from exc
    return {"status": "ok"}


@router.get("/api/v1/metadata/bounds")
def bounds() -> dict:
    return {"latitude": {"min": LAT_MIN, "max": LAT_MAX, "step": GRID_STEP}, "longitude": {"min": LON_MIN, "max": LON_MAX, "step": GRID_STEP}}


@router.get("/api/v1/metadata/depths")
def depths() -> dict:
    return {"valid_depths_meters": STANDARD_DEPTHS}


@router.get("/api/v1/metadata/available-dates")
def available_dates() -> dict:
    try:
        minimum, maximum = database.get_available_dates()
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable.") from exc
    return {"min_date": minimum, "max_date": maximum}


@router.get("/api/v1/ocean/historical")
def historical(
    lat: float = Query(ge=LAT_MIN, le=LAT_MAX),
    lon: float = Query(ge=LON_MIN, le=LON_MAX),
    date: date = Query(),
    depths: str | None = Query(default=None),
) -> dict:
    profile = database.get_historical_profile(lat, lon, date, _parse_depths(depths))
    if not profile:
        raise HTTPException(status_code=404, detail="No historical temperature data found for the requested coordinate and date.")
    return {"coordinate": {"lat": lat, "lon": lon}, "date": date, "profile": profile}


@router.post("/api/v1/ocean/predict")
def predict(request: PredictionRequest) -> dict:
    try:
        return run_mock_inference(request)
    except NoMockOutputError as exc:
        raise HTTPException(status_code=404, detail="No mock model output is available for the requested coordinate.") from exc
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable.") from exc
