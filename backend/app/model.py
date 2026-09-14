"""Replace run_mock_inference with a real model later without changing the API contract."""
from __future__ import annotations

import random
import time

from . import database
from .schemas import PredictionRequest


class NoMockOutputError(Exception):
    pass


def run_mock_inference(request: PredictionRequest) -> dict:
    started = time.perf_counter()
    available_dates = database.get_distinct_available_dates()
    if not available_dates:
        raise NoMockOutputError
    profile = database.get_mock_profile(request.location.lat, request.location.lon, random.choice(available_dates))
    if not profile:
        raise NoMockOutputError
    return {
        "model_status": "success",
        "inference_time_ms": int((time.perf_counter() - started) * 1000),
        "coordinate": {"lat": request.location.lat, "lon": request.location.lon},
        "target_date": request.target_date,
        "reconstructed_profile": profile,
    }
