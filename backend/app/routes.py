from __future__ import annotations

import json
from datetime import date, datetime

import psycopg
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from . import database
from .constants import GRID_STEP, LAT_MAX, LAT_MIN, LON_MAX, LON_MIN, STANDARD_DEPTHS
from .csv_parser import parse_long_csv
from .model import NoMockOutputError, stream_mock_inference
from .schemas import PredictionRequest

router = APIRouter()


def _parse_depths(depths: str | None) -> list[int] | None:
    if depths is None:
        return None
    try:
        parsed = [int(x.strip()) for x in depths.split(",") if x.strip()]
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="depths must be comma-separated integers.") from exc
    if not parsed or any(d not in STANDARD_DEPTHS for d in parsed):
        raise HTTPException(status_code=422, detail="Each depth must be a supported standard depth.")
    return parsed


def _json_default(obj: object) -> str:
    if isinstance(obj, (date, datetime)):
        return str(obj)
    raise TypeError(f"Not serialisable: {type(obj).__name__}")


def _line(obj: dict) -> bytes:
    return (json.dumps(obj, default=_json_default) + "\n").encode("utf-8")


# ── Metadata ──────────────────────────────────────────────────────────────────

@router.get("/health")
def health() -> dict:
    try:
        database.check_connection()
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Database unavailable.") from exc
    return {"status": "ok"}


@router.get("/api/v1/metadata/bounds")
def bounds() -> dict:
    return {
        "latitude":  {"min": LAT_MIN,  "max": LAT_MAX,  "step": GRID_STEP},
        "longitude": {"min": LON_MIN, "max": LON_MAX, "step": GRID_STEP},
    }


@router.get("/api/v1/metadata/depths")
def depths() -> dict:
    return {"valid_depths_meters": STANDARD_DEPTHS}


@router.get("/api/v1/metadata/available-dates")
def available_dates() -> dict:
    try:
        min_d, max_d = database.get_available_dates()
    except (psycopg.Error, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="Database unavailable.") from exc
    return {"min_date": min_d, "max_date": max_d}


# ── Historical — depth-wise NDJSON stream ─────────────────────────────────────

@router.get(
    "/api/v1/ocean/historical",
    response_class=StreamingResponse,
    responses={200: {"content": {"application/x-ndjson": {}}, "description": "NDJSON stream: metadata → depth_slice × N → complete"}},
)
def historical(
    date: date = Query(...),
    lat_min: float = Query(default=LAT_MIN, ge=LAT_MIN, le=LAT_MAX),
    lat_max: float = Query(default=LAT_MAX, ge=LAT_MIN, le=LAT_MAX),
    lon_min: float = Query(default=LON_MIN, ge=LON_MIN, le=LON_MAX),
    lon_max: float = Query(default=LON_MAX, ge=LON_MIN, le=LON_MAX),
    depths: str | None = Query(default=None, description="Comma-separated depth levels in metres"),
    lat: float | None = Query(default=None, ge=LAT_MIN, le=LAT_MAX, description="Point-query latitude (overrides bbox)"),
    lon: float | None = Query(default=None, ge=LON_MIN, le=LON_MAX, description="Point-query longitude (overrides bbox)"),
) -> StreamingResponse:
    if lat is not None and lon is not None:
        lat_min = lat_max = lat
        lon_min = lon_max = lon
    if lat_min > lat_max:
        raise HTTPException(status_code=422, detail="lat_min must be ≤ lat_max.")
    if lon_min > lon_max:
        raise HTTPException(status_code=422, detail="lon_min must be ≤ lon_max.")

    parsed = _parse_depths(depths)
    _d, _lamin, _lamax, _lomin, _lomax, _dep = date, lat_min, lat_max, lon_min, lon_max, parsed

    def generate():
        try:
            found = False
            for chunk in database.stream_historical_cube(_d, _lamin, _lamax, _lomin, _lomax, _dep):
                found = True
                yield _line(chunk)
            if not found:
                yield _line({"type": "error", "status_code": 404, "detail": "No data for the requested date and bounds."})
        except (psycopg.Error, RuntimeError) as exc:
            yield _line({"type": "error", "status_code": 503, "detail": str(exc)})

    return StreamingResponse(generate(), media_type="application/x-ndjson")


# ── Predict — dual input (JSON or CSV), depth-wise NDJSON stream ──────────────

@router.post(
    "/api/v1/ocean/predict",
    response_class=StreamingResponse,
    responses={200: {"content": {"application/x-ndjson": {}}, "description": "NDJSON stream: metadata (+ model fields) → depth_slice × N → complete (+ inference_ms)"}},
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/json": {
                    "schema": {
                        "type": "object",
                        "required": ["target_date", "surface_observations"],
                        "properties": {
                            "target_date": {"type": "string", "format": "date", "example": "2024-06-15"},
                            "surface_observations": {
                                "description": "Named dict of 7 feature matrices [101][241] OR 3-D tensor [7][101][241]. Values: float | int | null.",
                                "oneOf": [
                                    {
                                        "title": "Named dict (recommended)",
                                        "type": "object",
                                        "properties": {
                                            k: {"type": "array", "items": {"type": "array", "items": {"type": ["number", "null"]}}}
                                            for k in ["sst_c", "sss_psu", "sla_m", "u_current_ms", "v_current_ms", "u_wind_ms", "v_wind_ms"]
                                        },
                                    },
                                    {
                                        "title": "3-D tensor [7][101][241]",
                                        "type": "array",
                                        "items": {"type": "array", "items": {"type": "array", "items": {"type": ["number", "null"]}}},
                                    },
                                ],
                            },
                        },
                    },
                },
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "required": ["target_date", "observations"],
                        "properties": {
                            "target_date": {"type": "string", "format": "date", "example": "2024-06-15"},
                            "observations": {
                                "type": "string",
                                "format": "binary",
                                "description": "Long-format CSV: feature,lat,lon,value. Missing cells → null.",
                            },
                        },
                    },
                },
            },
        }
    },
)
async def predict(request: Request) -> StreamingResponse:
    """Accept surface observations as JSON or multipart/form-data CSV and stream mock prediction."""
    content_type = request.headers.get("content-type", "")

    if "multipart/form-data" in content_type:
        try:
            form = await request.form()
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Failed to parse form: {exc}") from exc

        if form.get("target_date") is None:
            raise HTTPException(status_code=422, detail="Missing form field 'target_date'.")
        obs_file = form.get("observations")
        if obs_file is None:
            raise HTTPException(status_code=422, detail="Missing form file 'observations'.")

        try:
            obs = parse_long_csv(await obs_file.read())
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"CSV parse error: {exc}") from exc
        try:
            pred_req = PredictionRequest(target_date=form["target_date"], surface_observations=obs)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
    else:
        try:
            body = await request.json()
            pred_req = PredictionRequest(**body)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    def generate():
        try:
            for chunk in stream_mock_inference(pred_req):
                yield _line(chunk)
        except NoMockOutputError:
            yield _line({"type": "error", "status_code": 404, "detail": "No mock output available."})
        except (psycopg.Error, RuntimeError) as exc:
            yield _line({"type": "error", "status_code": 503, "detail": str(exc)})

    return StreamingResponse(generate(), media_type="application/x-ndjson")
