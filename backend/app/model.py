"""Mock inference layer — swap stream_mock_inference for a real model without changing the API."""
from __future__ import annotations

import random
import time
from typing import Generator

from . import database
from .schemas import PredictionRequest


class NoMockOutputError(Exception):
    pass


def stream_mock_inference(request: PredictionRequest) -> Generator[dict, None, None]:
    """Yield NDJSON chunks identical to stream_historical_cube, with model metadata injected.

    Raises NoMockOutputError if no reference data exists.
    """
    started = time.perf_counter()
    dates = database.get_distinct_available_dates()
    if not dates:
        raise NoMockOutputError

    chosen = random.choice(dates)

    for chunk in database.stream_historical_cube(chosen):
        if chunk["type"] == "metadata":
            chunk["model_status"] = "success"
            chunk["target_date"] = str(request.target_date)
            chunk["source_reference_date"] = str(chosen)
            chunk["inference_start_ms"] = int((time.perf_counter() - started) * 1000)
        if chunk["type"] == "complete":
            chunk["total_inference_ms"] = int((time.perf_counter() - started) * 1000)
        yield chunk
