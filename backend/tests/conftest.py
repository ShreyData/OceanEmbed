from datetime import date

import pytest
from fastapi.testclient import TestClient

from app import database
from app.main import app


@pytest.fixture
def client(monkeypatch):
    profile = [{"depth_m": 0, "temperature_c": 28.5}, {"depth_m": 5, "temperature_c": 28.4}, {"depth_m": 100, "temperature_c": 22.1}]

    monkeypatch.setattr(database, "check_connection", lambda: None)
    monkeypatch.setattr(database, "get_available_dates", lambda: (date(2020, 1, 1), date(2020, 1, 31)))
    monkeypatch.setattr(database, "get_distinct_available_dates", lambda: [date(2020, 1, 15)])

    def historical(lat, lon, requested_date, depths=None):
        if (lat, lon, requested_date) != (15.25, 65.5, date(2020, 1, 15)):
            return []
        return [row for row in profile if depths is None or row["depth_m"] in depths]

    monkeypatch.setattr(database, "get_historical_profile", historical)
    monkeypatch.setattr(database, "get_mock_profile", lambda lat, lon, source_date: profile if (lat, lon) == (15.25, 65.5) else [])
    return TestClient(app)


@pytest.fixture
def payload():
    return {
        "target_date": "2026-09-15",
        "location": {"lat": 15.25, "lon": 65.5},
        "surface_observations": {"sst_c": 29.1, "sss_psu": 35.2, "sla_m": 0.15, "u_current_ms": 0.05, "v_current_ms": -0.12, "u_wind_ms": 5.4, "v_wind_ms": 2.1},
    }
