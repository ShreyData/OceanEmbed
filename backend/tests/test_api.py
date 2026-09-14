import pytest

from app.constants import SURFACE_FEATURE_NAMES


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_metadata(client):
    assert client.get("/api/v1/metadata/bounds").json()["latitude"] == {"min": 5.0, "max": 30.0, "step": 0.25}
    assert client.get("/api/v1/metadata/depths").json()["valid_depths_meters"] == [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]
    assert client.get("/api/v1/metadata/available-dates").json() == {"min_date": "2020-01-01", "max_date": "2020-01-31"}


def test_historical_cube_full(client):
    res = client.get("/api/v1/ocean/historical?date=2020-01-15")
    assert res.status_code == 200
    data = res.json()
    assert data["date"] == "2020-01-15"
    assert data["shape"] == [15, 101, 241]
    assert len(data["dimensions"]["depths"]) == 15
    assert len(data["dimensions"]["latitudes"]) == 101
    assert len(data["dimensions"]["longitudes"]) == 241
    assert len(data["values"]) == 15
    assert len(data["values"][0]) == 101
    assert len(data["values"][0][0]) == 241


def test_historical_cube_subbox_and_depths(client):
    res = client.get("/api/v1/ocean/historical?date=2020-01-15&lat_min=10&lat_max=15&lon_min=60&lon_max=70&depths=0,100")
    assert res.status_code == 200
    data = res.json()
    assert data["shape"] == [2, 21, 41]
    assert data["dimensions"]["depths"] == [0, 100]


def test_historical_point_query(client):
    res = client.get("/api/v1/ocean/historical?date=2020-01-15&lat=15.25&lon=65.5")
    assert res.status_code == 200
    data = res.json()
    assert data["shape"] == [15, 1, 1]


@pytest.mark.parametrize("url", [
    "/api/v1/ocean/historical?date=2020-01-15&lat_min=4.9",
    "/api/v1/ocean/historical?date=2020-01-15&lat_max=30.1",
    "/api/v1/ocean/historical?date=2020-01-15&lon_min=44.9",
    "/api/v1/ocean/historical?date=2020-01-15&lon_max=105.1",
    "/api/v1/ocean/historical?date=2020-01-15&lat_min=20&lat_max=10",
    "/api/v1/ocean/historical?date=2020-01-15&lon_min=80&lon_max=70",
    "/api/v1/ocean/historical?date=not-a-date",
    "/api/v1/ocean/historical?date=2020-01-15&depths=0,7",
    "/api/v1/ocean/historical",  # missing required date
])
def test_historical_validation(client, url):
    assert client.get(url).status_code == 422


def test_historical_missing_date(client):
    res = client.get("/api/v1/ocean/historical?date=2020-01-16")
    assert res.status_code == 404


def test_prediction_3d_tensor_success(client, payload):
    res = client.post("/api/v1/ocean/predict", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["model_status"] == "success"
    assert data["target_date"] == payload["target_date"]
    assert data["shape"] == [15, 101, 241]
    assert len(data["values"]) == 15


def test_prediction_dict_format_success(client):
    dict_payload = {
        "target_date": "2026-09-15",
        "surface_observations": {
            name: [[25.0] * 241 for _ in range(101)] for name in SURFACE_FEATURE_NAMES
        },
    }
    res = client.post("/api/v1/ocean/predict", json=dict_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["shape"] == [15, 101, 241]


def test_prediction_wrong_channel_count(client):
    bad = {
        "target_date": "2026-09-15",
        "surface_observations": [[[20.0] * 241 for _ in range(101)] for _ in range(6)],  # 6 instead of 7
    }
    res = client.post("/api/v1/ocean/predict", json=bad)
    assert res.status_code == 422
    assert "7 feature channels" in res.json()["detail"][0]["msg"]


def test_prediction_wrong_row_count(client):
    bad = {
        "target_date": "2026-09-15",
        "surface_observations": [[[20.0] * 241 for _ in range(100)] for _ in range(7)],  # 100 instead of 101
    }
    res = client.post("/api/v1/ocean/predict", json=bad)
    assert res.status_code == 422
    assert "101 latitude rows" in res.json()["detail"][0]["msg"]


def test_prediction_wrong_col_count(client):
    bad = {
        "target_date": "2026-09-15",
        "surface_observations": [[[20.0] * 240 for _ in range(101)] for _ in range(7)],  # 240 instead of 241
    }
    res = client.post("/api/v1/ocean/predict", json=bad)
    assert res.status_code == 422
    assert "241 longitude columns" in res.json()["detail"][0]["msg"]


def test_prediction_missing_dict_key(client):
    incomplete = {
        name: [[25.0] * 241 for _ in range(101)] for name in SURFACE_FEATURE_NAMES[:6]  # missing 7th
    }
    bad = {"target_date": "2026-09-15", "surface_observations": incomplete}
    res = client.post("/api/v1/ocean/predict", json=bad)
    assert res.status_code == 422
    assert "missing required features" in res.json()["detail"][0]["msg"]


def test_prediction_invalid_value_type(client):
    matrix = [[[20.0] * 241 for _ in range(101)] for _ in range(7)]
    matrix[0][0][0] = "not-a-number"
    bad = {"target_date": "2026-09-15", "surface_observations": matrix}
    res = client.post("/api/v1/ocean/predict", json=bad)
    assert res.status_code == 422
    assert "invalid non-numeric value" in res.json()["detail"][0]["msg"]
