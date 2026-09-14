from datetime import date

import pytest
from fastapi.testclient import TestClient

from app import database
from app.constants import LATITUDES, LONGITUDES, STANDARD_DEPTHS
from app.main import app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(database, "check_connection", lambda: None)
    monkeypatch.setattr(database, "get_available_dates", lambda: (date(2020, 1, 1), date(2020, 1, 31)))
    monkeypatch.setattr(database, "get_distinct_available_dates", lambda: [date(2020, 1, 15)])

    def mock_get_cube(requested_date, lat_min=5.0, lat_max=30.0, lon_min=45.0, lon_max=105.0, depths=None):
        if requested_date != date(2020, 1, 15):
            return None
        d_list = [d for d in STANDARD_DEPTHS if depths is None or d in depths]
        lats = [l for l in LATITUDES if lat_min <= l <= lat_max]
        lons = [l for l in LONGITUDES if lon_min <= l <= lon_max]
        if not d_list or not lats or not lons:
            return None
        return {
            "date": requested_date,
            "dimensions": {"depths": d_list, "latitudes": lats, "longitudes": lons},
            "shape": [len(d_list), len(lats), len(lons)],
            "values": [[[25.0] * len(lons) for _ in range(len(lats))] for _ in range(len(d_list))],
        }

    monkeypatch.setattr(database, "get_historical_cube", mock_get_cube)
    return TestClient(app)


@pytest.fixture
def payload():
    return {
        "target_date": "2026-09-15",
        "surface_observations": [[[28.0] * 241 for _ in range(101)] for _ in range(7)],
    }
