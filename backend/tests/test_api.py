import copy

import pytest


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_metadata(client):
    assert client.get("/api/v1/metadata/bounds").json()["latitude"] == {"min": 5.0, "max": 30.0, "step": 0.25}
    assert client.get("/api/v1/metadata/depths").json()["valid_depths_meters"] == [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]
    assert client.get("/api/v1/metadata/available-dates").json() == {"min_date": "2020-01-01", "max_date": "2020-01-31"}


def test_historical_success_and_filter(client):
    url = "/api/v1/ocean/historical?lat=15.25&lon=65.5&date=2020-01-15"
    assert len(client.get(url).json()["profile"]) == 3
    assert client.get(url + "&depths=0,100").json()["profile"] == [{"depth_m": 0, "temperature_c": 28.5}, {"depth_m": 100, "temperature_c": 22.1}]


@pytest.mark.parametrize("url", [
    "/api/v1/ocean/historical?lat=4.9&lon=65.5&date=2020-01-15",
    "/api/v1/ocean/historical?lat=15.25&lon=105.1&date=2020-01-15",
    "/api/v1/ocean/historical?lat=15.25&lon=65.5&date=not-a-date",
    "/api/v1/ocean/historical?lat=15.25&lon=65.5&date=2020-01-15&depths=0,7",
    "/api/v1/ocean/historical?lon=65.5&date=2020-01-15",
])
def test_historical_validation(client, url):
    assert client.get(url).status_code == 422


def test_historical_missing_data(client):
    response = client.get("/api/v1/ocean/historical?lat=15.25&lon=65.5&date=2020-01-16")
    assert response.status_code == 404


def test_prediction_success(client, payload):
    response = client.post("/api/v1/ocean/predict", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["target_date"] == payload["target_date"]
    assert body["model_status"] == "success"


@pytest.mark.parametrize("field", ["sst_c", "sss_psu", "sla_m", "u_current_ms", "v_current_ms", "u_wind_ms", "v_wind_ms"])
def test_prediction_requires_each_surface_value(client, payload, field):
    del payload["surface_observations"][field]
    assert client.post("/api/v1/ocean/predict", json=payload).status_code == 422


@pytest.mark.parametrize("mutate", [
    lambda p: p["surface_observations"].update({"sst_c": None}),
    lambda p: p["surface_observations"].update({"sst_c": "29.1"}),
    lambda p: p["location"].update({"lat": 4.0}),
    lambda p: p["location"].update({"lon": 106.0}),
    lambda p: p.update({"target_date": "bad-date"}),
    lambda p: p.update({"unexpected": True}),
])
def test_prediction_strict_validation(client, payload, mutate):
    mutate(payload)
    assert client.post("/api/v1/ocean/predict", json=payload).status_code == 422


def test_prediction_coordinate_not_present(client, payload):
    payload["location"]["lat"] = 15.5
    assert client.post("/api/v1/ocean/predict", json=payload).status_code == 404
