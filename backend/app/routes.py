from __future__ import annotations

from datetime import date

import psycopg
from fastapi import APIRouter, HTTPException, Query

from . import database, snapping
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
    date: date = Query(..., description="Target date for historical 3D temperature cube"),
    lat_min: float = Query(default=LAT_MIN, ge=LAT_MIN, le=LAT_MAX, description="Minimum latitude (South)"),
    lat_max: float = Query(default=LAT_MAX, ge=LAT_MIN, le=LAT_MAX, description="Maximum latitude (North)"),
    lon_min: float = Query(default=LON_MIN, ge=LON_MIN, le=LON_MAX, description="Minimum longitude (West)"),
    lon_max: float = Query(default=LON_MAX, ge=LON_MIN, le=LON_MAX, description="Maximum longitude (East)"),
    depths: str | None = Query(default=None, description="Comma-separated depth levels in meters"),
    lat: float | None = Query(default=None, ge=LAT_MIN, le=LAT_MAX, description="Optional point query latitude"),
    lon: float | None = Query(default=None, ge=LON_MIN, le=LON_MAX, description="Optional point query longitude"),
) -> dict:
    if lat is not None and lon is not None:
        lat_min = lat_max = lat
        lon_min = lon_max = lon

    if lat_min > lat_max:
        raise HTTPException(status_code=422, detail="lat_min must be less than or equal to lat_max.")
    if lon_min > lon_max:
        raise HTTPException(status_code=422, detail="lon_min must be less than or equal to lon_max.")

    parsed_depths = _parse_depths(depths)
    try:
        cube = database.get_historical_cube(
            requested_date=date,
            lat_min=lat_min,
            lat_max=lat_max,
            lon_min=lon_min,
            lon_max=lon_max,
            depths=parsed_depths,
        )
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable.") from exc

    if not cube:
        raise HTTPException(status_code=404, detail="No historical temperature data found for the requested date and bounds.")

    return cube


@router.post("/api/v1/ocean/predict")
def predict(request: PredictionRequest) -> dict:
    try:
        return run_mock_inference(request)
    except NoMockOutputError as exc:
        raise HTTPException(status_code=404, detail="No mock model output is available.") from exc
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Database is unavailable.") from exc

