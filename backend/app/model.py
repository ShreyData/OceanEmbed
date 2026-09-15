"""Replace stream_mock_inference with a real model later without changing the API contract.

The function is a synchronous generator that yields NDJSON-ready dicts.
The mock strategy: pick a random existing GLORYS date and stream its cube
depth-by-depth, injecting model metadata into the leading metadata chunk.
"""
from __future__ import annotations

import random
import time
from typing import Generator

from . import database
from .schemas import PredictionRequest


class NoMockOutputError(Exception):
    pass


def stream_mock_inference(request: PredictionRequest) -> Generator[dict, None, None]:
    """Yield NDJSON-ready dicts that mimic a real model's streaming inference output.

    Chunk order:
      1. ``{"type": "metadata", ...}``      – cube dimensions + model provenance
      2. ``{"type": "depth_slice", ...}``   – one per depth level (float16 values)
      3. ``{"type": "complete", ...}``      – end-of-stream marker with total timing

    Raises:
        NoMockOutputError: if no reference data exists in the database.
    """
    started = time.perf_counter()

    available_dates = database.get_distinct_available_dates()
    if not available_dates:
        raise NoMockOutputError

    # Fake prediction: randomly select an existing GLORYS day as the "model output"
    chosen_date = random.choice(available_dates)

    first_chunk = True
    for chunk in database.stream_historical_cube(chosen_date):
        if first_chunk and chunk["type"] == "metadata":
            # Inject model-level provenance into the leading metadata chunk
            chunk["model_status"] = "success"
            chunk["target_date"] = str(request.target_date)
            chunk["source_reference_date"] = str(chosen_date)
            chunk["inference_start_ms"] = int((time.perf_counter() - started) * 1000)
            first_chunk = False

        if chunk["type"] == "complete":
            # Append total wall-clock inference time to the final marker
            chunk["total_inference_ms"] = int((time.perf_counter() - started) * 1000)

        yield chunk
