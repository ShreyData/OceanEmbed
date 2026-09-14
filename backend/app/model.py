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

    # Fake prediction: randomly select an existing day from GLORYS data
    chosen_date = random.choice(available_dates)
    cube_data = database.get_historical_cube(chosen_date)
    if not cube_data:
        raise NoMockOutputError

    return {
        "model_status": "success",
        "inference_time_ms": int((time.perf_counter() - started) * 1000),
        "target_date": request.target_date,
        "source_reference_date": chosen_date,
        "dimensions": cube_data["dimensions"],
        "shape": cube_data["shape"],
        "values": cube_data["values"],
    }
