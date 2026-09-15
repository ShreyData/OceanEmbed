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


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

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


def _json_default(obj: object) -> str:
    """JSON fallback for non-serialisable types (e.g. date)."""
    if isinstance(obj, (date, datetime)):
        return str(obj)
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serialisable")


def _ndjson_line(obj: dict) -> bytes:
    """Serialise a dict to a UTF-8 newline-delimited JSON line."""
    return (json.dumps(obj, default=_json_default) + "\n").encode("utf-8")


# ─────────────────────────────────────────────────────────────────────────────
# Metadata routes  (unchanged)
# ─────────────────────────────────────────────────────────────────────────────

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


# ─────────────────────────────────────────────────────────────────────────────
# Ocean – historical  (streaming NDJSON, depth-by-depth)
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/api/v1/ocean/historical",
    response_class=StreamingResponse,
    responses={
        200: {
            "content": {"application/x-ndjson": {}},
            "description": (
                "Stream of NDJSON lines. "
                "Line 1: metadata chunk. "
                "Lines 2…N: one depth_slice per depth level (float16 values). "
                "Final line: complete marker."
            ),
        }
    },
)
def historical(
    date: date = Query(..., description="Target date for historical 3D temperature cube"),
    lat_min: float = Query(default=LAT_MIN, ge=LAT_MIN, le=LAT_MAX, description="Minimum latitude (South)"),
    lat_max: float = Query(default=LAT_MAX, ge=LAT_MIN, le=LAT_MAX, description="Maximum latitude (North)"),
    lon_min: float = Query(default=LON_MIN, ge=LON_MIN, le=LON_MAX, description="Minimum longitude (West)"),
    lon_max: float = Query(default=LON_MAX, ge=LON_MIN, le=LON_MAX, description="Maximum longitude (East)"),
    depths: str | None = Query(default=None, description="Comma-separated depth levels in meters"),
    lat: float | None = Query(default=None, ge=LAT_MIN, le=LAT_MAX, description="Optional point query latitude"),
    lon: float | None = Query(default=None, ge=LON_MIN, le=LON_MAX, description="Optional point query longitude"),
) -> StreamingResponse:
    if lat is not None and lon is not None:
        lat_min = lat_max = lat
        lon_min = lon_max = lon

    if lat_min > lat_max:
        raise HTTPException(status_code=422, detail="lat_min must be less than or equal to lat_max.")
    if lon_min > lon_max:
        raise HTTPException(status_code=422, detail="lon_min must be less than or equal to lon_max.")

    parsed_depths = _parse_depths(depths)

    # Capture loop variables for the closure
    _date, _lat_min, _lat_max, _lon_min, _lon_max, _depths = date, lat_min, lat_max, lon_min, lon_max, parsed_depths

    def generate():
        try:
            found_any = False
            for chunk in database.stream_historical_cube(
                requested_date=_date,
                lat_min=_lat_min,
                lat_max=_lat_max,
                lon_min=_lon_min,
                lon_max=_lon_max,
                depths=_depths,
            ):
                found_any = True
                yield _ndjson_line(chunk)

            if not found_any:
                yield _ndjson_line({
                    "type": "error",
                    "status_code": 404,
                    "detail": "No historical temperature data found for the requested date and bounds.",
                })
        except (psycopg.Error, RuntimeError) as exc:
            yield _ndjson_line({"type": "error", "status_code": 503, "detail": str(exc)})

    return StreamingResponse(generate(), media_type="application/x-ndjson")


# ─────────────────────────────────────────────────────────────────────────────
# Ocean – predict  (dual input: JSON body OR multipart/CSV, streaming NDJSON)
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/api/v1/ocean/predict",
    response_class=StreamingResponse,
    responses={
        200: {
            "content": {"application/x-ndjson": {}},
            "description": (
                "Stream of NDJSON lines identical to /historical, "
                "with model_status / target_date / source_reference_date injected "
                "into the metadata chunk and total_inference_ms in the complete chunk."
            ),
        }
    },
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                # ── Option 1: JSON body ──────────────────────────────────────
                "application/json": {
                    "schema": {
                        "type": "object",
                        "required": ["target_date", "surface_observations"],
                        "properties": {
                            "target_date": {
                                "type": "string",
                                "format": "date",
                                "example": "2024-06-15",
                                "description": "Future date to predict (YYYY-MM-DD).",
                            },
                            "surface_observations": {
                                "description": (
                                    "Named dict of 7 feature matrices each 101×241 "
                                    "(sst_c, sss_psu, sla_m, u_current_ms, v_current_ms, u_wind_ms, v_wind_ms), "
                                    "OR a 3-D array [7][101][241]. "
                                    "Cell values: float | int | null. Float16-range accepted."
                                ),
                                "oneOf": [
                                    {
                                        "title": "Named dict (recommended)",
                                        "type": "object",
                                        "properties": {
                                            k: {
                                                "type": "array",
                                                "items": {"type": "array", "items": {"type": ["number", "null"]}},
                                            }
                                            for k in ["sst_c", "sss_psu", "sla_m", "u_current_ms", "v_current_ms", "u_wind_ms", "v_wind_ms"]
                                        },
                                    },
                                    {
                                        "title": "3-D tensor [7][101][241]",
                                        "type": "array",
                                        "items": {
                                            "type": "array",
                                            "items": {"type": "array", "items": {"type": ["number", "null"]}},
                                        },
                                    },
                                ],
                            },
                        },
                    },
                    "example": {
                        "target_date": "2024-06-15",
                        "surface_observations": {
                            "sst_c":        "<<101×241 float matrix>>",
                            "sss_psu":      "<<101×241 float matrix>>",
                            "sla_m":        "<<101×241 float matrix>>",
                            "u_current_ms": "<<101×241 float matrix>>",
                            "v_current_ms": "<<101×241 float matrix>>",
                            "u_wind_ms":    "<<101×241 float matrix>>",
                            "v_wind_ms":    "<<101×241 float matrix>>",
                        },
                    },
                },
                # ── Option 2: Multipart CSV upload ───────────────────────────
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "required": ["target_date", "observations"],
                        "properties": {
                            "target_date": {
                                "type": "string",
                                "format": "date",
                                "example": "2024-06-15",
                                "description": "Future date to predict (YYYY-MM-DD).",
                            },
                            "observations": {
                                "type": "string",
                                "format": "binary",
                                "description": (
                                    "Long-format CSV with header: feature,lat,lon,value. "
                                    "Supported features: sst_c, sss_psu, sla_m, "
                                    "u_current_ms, v_current_ms, u_wind_ms, v_wind_ms. "
                                    "Missing grid cells default to null. "
                                    "Out-of-grid coordinates are silently skipped."
                                ),
                            },
                        },
                    },
                },
            },
        }
    },
)
async def predict(request: Request) -> StreamingResponse:
    """Accept surface observations in two formats and stream the mock prediction.

    **JSON body** (``Content-Type: application/json``):
    ```json
    {
      "target_date": "2024-06-01",
      "surface_observations": { "sst_c": [[...], ...], "sss_psu": [[...], ...], ... }
    }
    ```
    Each feature matrix is ``NUM_LATS × NUM_LONS`` (101 × 241). Values may be
    float, int, or ``null`` (masked cell). Float16-range values are accepted.

    **Multipart form** (``Content-Type: multipart/form-data``):
    - Field ``target_date``: date string (``YYYY-MM-DD``)
    - File  ``observations``: long-format CSV with header ``feature,lat,lon,value``

    Long-format CSV example::

        feature,lat,lon,value
        sst_c,12.5,67.0,28.3
        sst_c,12.5,67.25,28.1
        sss_psu,12.5,67.0,35.1
        ...

    Missing grid cells default to ``null``. Out-of-grid rows are silently skipped.
    """
    content_type = request.headers.get("content-type", "")

    # ── parse input ───────────────────────────────────────────────────────
    if "multipart/form-data" in content_type:
        # ── CSV path ──────────────────────────────────────────────────────
        try:
            form = await request.form()
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Failed to parse multipart form: {exc}") from exc

        target_date_raw = form.get("target_date")
        obs_file = form.get("observations")

        if target_date_raw is None:
            raise HTTPException(status_code=422, detail="Missing form field 'target_date'.")
        if obs_file is None:
            raise HTTPException(status_code=422, detail="Missing form file 'observations'.")

        try:
            raw_csv = await obs_file.read()
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Could not read observations file: {exc}") from exc

        try:
            surface_observations = parse_long_csv(raw_csv)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"CSV parse error: {exc}") from exc

        try:
            pred_request = PredictionRequest(
                target_date=target_date_raw,
                surface_observations=surface_observations,
            )
        except Exception as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    else:
        # ── JSON path ─────────────────────────────────────────────────────
        try:
            body = await request.json()
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"Invalid JSON body: {exc}") from exc

        try:
            pred_request = PredictionRequest(**body)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    # ── stream inference output ───────────────────────────────────────────
    def generate():
        try:
            for chunk in stream_mock_inference(pred_request):
                yield _ndjson_line(chunk)
        except NoMockOutputError:
            yield _ndjson_line({
                "type": "error",
                "status_code": 404,
                "detail": "No mock model output is available.",
            })
        except (psycopg.Error, RuntimeError) as exc:
            yield _ndjson_line({"type": "error", "status_code": 503, "detail": str(exc)})

    return StreamingResponse(generate(), media_type="application/x-ndjson")
