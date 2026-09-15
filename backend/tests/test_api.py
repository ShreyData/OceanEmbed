"""API tests for the OceanEmbed backend.

All data endpoints now stream NDJSON (application/x-ndjson).
Helpers parse_ndjson / ndjson_chunk from conftest make assertions clean.
"""
from __future__ import annotations

import io

import pytest

from app.constants import SURFACE_FEATURE_NAMES
from tests.conftest import ndjson_chunk, parse_ndjson


# ─────────────────────────────────────────────────────────────────────────────
# Health + metadata  (still plain JSON)
# ─────────────────────────────────────────────────────────────────────────────

def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_metadata(client):
    assert client.get("/api/v1/metadata/bounds").json()["latitude"] == {"min": 5.0, "max": 30.0, "step": 0.25}
    assert client.get("/api/v1/metadata/depths").json()["valid_depths_meters"] == [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]
    assert client.get("/api/v1/metadata/available-dates").json() == {"min_date": "2020-01-01", "max_date": "2020-01-31"}


# ─────────────────────────────────────────────────────────────────────────────
# Historical – NDJSON streaming
# ─────────────────────────────────────────────────────────────────────────────

def test_historical_cube_full(client):
    res = client.get("/api/v1/ocean/historical?date=2020-01-15")
    assert res.status_code == 200
    assert "application/x-ndjson" in res.headers["content-type"]

    chunks = parse_ndjson(res.text)
    meta = ndjson_chunk(chunks, "metadata")
    complete = ndjson_chunk(chunks, "complete")
    depth_slices = [c for c in chunks if c.get("type") == "depth_slice"]

    assert meta is not None
    assert meta["date"] == "2020-01-15"
    assert meta["shape"] == [15, 101, 241]
    assert len(meta["depths"]) == 15
    assert len(meta["latitudes"]) == 101
    assert len(meta["longitudes"]) == 241

    assert len(depth_slices) == 15
    assert len(depth_slices[0]["values"]) == 101
    assert len(depth_slices[0]["values"][0]) == 241

    assert complete is not None
    assert complete["total_depth_slices"] == 15


def test_historical_cube_subbox_and_depths(client):
    res = client.get("/api/v1/ocean/historical?date=2020-01-15&lat_min=10&lat_max=15&lon_min=60&lon_max=70&depths=0,100")
    assert res.status_code == 200

    chunks = parse_ndjson(res.text)
    meta = ndjson_chunk(chunks, "metadata")
    depth_slices = [c for c in chunks if c.get("type") == "depth_slice"]

    assert meta["shape"] == [2, 21, 41]
    assert meta["depths"] == [0, 100]
    assert len(depth_slices) == 2


def test_historical_point_query(client):
    res = client.get("/api/v1/ocean/historical?date=2020-01-15&lat=15.25&lon=65.5")
    assert res.status_code == 200

    chunks = parse_ndjson(res.text)
    meta = ndjson_chunk(chunks, "metadata")
    assert meta["shape"] == [15, 1, 1]


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
    """Date with no data → stream an error chunk (200 OK, error inside body)."""
    res = client.get("/api/v1/ocean/historical?date=2020-01-16")
    assert res.status_code == 200  # headers sent before data; error is in-stream
    chunks = parse_ndjson(res.text)
    err = ndjson_chunk(chunks, "error")
    assert err is not None
    assert err["status_code"] == 404


# ─────────────────────────────────────────────────────────────────────────────
# Predict – JSON body, NDJSON streaming
# ─────────────────────────────────────────────────────────────────────────────

def test_prediction_3d_tensor_success(client, payload):
    res = client.post("/api/v1/ocean/predict", json=payload)
    assert res.status_code == 200

    chunks = parse_ndjson(res.text)
    meta = ndjson_chunk(chunks, "metadata")
    depth_slices = [c for c in chunks if c.get("type") == "depth_slice"]
    complete = ndjson_chunk(chunks, "complete")

    assert meta["model_status"] == "success"
    assert meta["target_date"] == payload["target_date"]
    assert meta["shape"] == [15, 101, 241]
    assert len(depth_slices) == 15
    assert complete is not None
    assert "total_inference_ms" in complete


def test_prediction_dict_format_success(client):
    dict_payload = {
        "target_date": "2026-09-15",
        "surface_observations": {
            name: [[25.0] * 241 for _ in range(101)] for name in SURFACE_FEATURE_NAMES
        },
    }
    res = client.post("/api/v1/ocean/predict", json=dict_payload)
    assert res.status_code == 200
    meta = ndjson_chunk(parse_ndjson(res.text), "metadata")
    assert meta["shape"] == [15, 101, 241]


def test_prediction_wrong_channel_count(client):
    bad = {
        "target_date": "2026-09-15",
        "surface_observations": [[[20.0] * 241 for _ in range(101)] for _ in range(6)],  # 6 instead of 7
    }
    res = client.post("/api/v1/ocean/predict", json=bad)
    assert res.status_code == 422
    assert "7 feature channels" in res.json()["detail"]


def test_prediction_wrong_row_count(client):
    bad = {
        "target_date": "2026-09-15",
        "surface_observations": [[[20.0] * 241 for _ in range(100)] for _ in range(7)],  # 100 instead of 101
    }
    res = client.post("/api/v1/ocean/predict", json=bad)
    assert res.status_code == 422
    assert "101 latitude rows" in res.json()["detail"]


def test_prediction_wrong_col_count(client):
    bad = {
        "target_date": "2026-09-15",
        "surface_observations": [[[20.0] * 240 for _ in range(101)] for _ in range(7)],  # 240 instead of 241
    }
    res = client.post("/api/v1/ocean/predict", json=bad)
    assert res.status_code == 422
    assert "241 longitude columns" in res.json()["detail"]


def test_prediction_missing_dict_key(client):
    incomplete = {
        name: [[25.0] * 241 for _ in range(101)] for name in SURFACE_FEATURE_NAMES[:6]  # missing 7th
    }
    bad = {"target_date": "2026-09-15", "surface_observations": incomplete}
    res = client.post("/api/v1/ocean/predict", json=bad)
    assert res.status_code == 422
    assert "missing required features" in res.json()["detail"]


def test_prediction_invalid_value_type(client):
    matrix = [[[20.0] * 241 for _ in range(101)] for _ in range(7)]
    matrix[0][0][0] = "not-a-number"
    bad = {"target_date": "2026-09-15", "surface_observations": matrix}
    res = client.post("/api/v1/ocean/predict", json=bad)
    assert res.status_code == 422
    assert "invalid non-numeric value" in res.json()["detail"]


# ─────────────────────────────────────────────────────────────────────────────
# Predict – CSV multipart input
# ─────────────────────────────────────────────────────────────────────────────

def _make_csv(feature_values: dict[str, float] = None) -> bytes:
    """Generate a minimal long-format CSV with uniform values per feature."""
    from app.constants import LATITUDES, LONGITUDES, SURFACE_FEATURE_NAMES
    feature_values = feature_values or {f: 25.0 for f in SURFACE_FEATURE_NAMES}
    lines = ["feature,lat,lon,value"]
    for feat, val in feature_values.items():
        for lat in LATITUDES[:3]:   # 3 rows is enough for validation
            for lon in LONGITUDES[:3]:
                lines.append(f"{feat},{lat},{lon},{val}")
    return "\n".join(lines).encode()


def test_prediction_csv_success(client):
    csv_bytes = _make_csv()
    res = client.post(
        "/api/v1/ocean/predict",
        data={"target_date": "2026-09-15"},
        files={"observations": ("obs.csv", io.BytesIO(csv_bytes), "text/csv")},
    )
    assert res.status_code == 200
    meta = ndjson_chunk(parse_ndjson(res.text), "metadata")
    assert meta["model_status"] == "success"
    assert meta["target_date"] == "2026-09-15"


def test_prediction_csv_missing_file(client):
    res = client.post(
        "/api/v1/ocean/predict",
        data={"target_date": "2026-09-15"},
        # no 'observations' file
    )
    assert res.status_code == 422


def test_prediction_csv_missing_target_date(client):
    csv_bytes = _make_csv()
    res = client.post(
        "/api/v1/ocean/predict",
        # no 'target_date' field
        files={"observations": ("obs.csv", io.BytesIO(csv_bytes), "text/csv")},
    )
    assert res.status_code == 422


def test_prediction_csv_bad_header(client):
    bad_csv = b"wrong,columns,here\n1,2,3"
    res = client.post(
        "/api/v1/ocean/predict",
        data={"target_date": "2026-09-15"},
        files={"observations": ("obs.csv", io.BytesIO(bad_csv), "text/csv")},
    )
    assert res.status_code == 422
    assert "missing required column" in res.json()["detail"].lower()
