"""Shared pytest fixtures for the OceanEmbed backend test suite."""
from __future__ import annotations

import json
from datetime import date

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app import database
from app.constants import LATITUDES, LONGITUDES, STANDARD_DEPTHS
from app.main import app


def parse_ndjson(text: str) -> list[dict]:
    """Parse a newline-delimited JSON response body into a list of dicts."""
    return [json.loads(line) for line in text.strip().splitlines() if line.strip()]


def ndjson_chunk(chunks: list[dict], chunk_type: str) -> dict | None:
    """Return the first chunk with a matching 'type' key, or None."""
    return next((c for c in chunks if c.get("type") == chunk_type), None)


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(database, "check_connection", lambda: None)
    monkeypatch.setattr(database, "get_available_dates", lambda: (date(2020, 1, 1), date(2020, 1, 31)))
    monkeypatch.setattr(database, "get_distinct_available_dates", lambda: [date(2020, 1, 15)])

    def mock_stream_cube(
        requested_date,
        lat_min=5.0,
        lat_max=30.0,
        lon_min=45.0,
        lon_max=105.0,
        depths=None,
    ):
        """Minimal streaming mock that yields the same NDJSON chunk shapes as the real function."""
        if requested_date != date(2020, 1, 15):
            return  # empty generator → no data

        d_list = [d for d in STANDARD_DEPTHS if depths is None or d in depths]
        lats = [lat for lat in LATITUDES if lat_min <= lat <= lat_max]
        lons = [lon for lon in LONGITUDES if lon_min <= lon <= lon_max]
        if not d_list or not lats or not lons:
            return

        yield {
            "type": "metadata",
            "date": str(requested_date),
            "depths": d_list,
            "latitudes": lats,
            "longitudes": lons,
            "shape": [len(d_list), len(lats), len(lons)],
            "dtype": "float16",
        }
        for i, depth in enumerate(d_list):
            yield {
                "type": "depth_slice",
                "depth_index": i,
                "depth_m": depth,
                "values": [[25.0] * len(lons) for _ in range(len(lats))],
            }
        yield {"type": "complete", "total_depth_slices": len(d_list)}

    monkeypatch.setattr(database, "stream_historical_cube", mock_stream_cube)
    return TestClient(app)


@pytest.fixture
def payload():
    return {
        "target_date": "2026-09-15",
        "surface_observations": [[[28.0] * 241 for _ in range(101)] for _ in range(7)],
    }
