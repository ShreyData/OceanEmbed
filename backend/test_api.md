# OceanEmbed API — Frontend Test Guide

Base URL: `http://localhost:8000`  
All data endpoints return **NDJSON** (`application/x-ndjson`) — one JSON object per line.  
Use `-N` with curl to see lines stream in real time.

---

## NDJSON Stream Format

Every data response follows this sequence:

```jsonc
// Line 1 — always first
{"type": "metadata", "date": "...", "depths": [...], "latitudes": [...], "longitudes": [...], "shape": [D, L, Lo], "dtype": "float16"}

// Lines 2..N+1 — one per depth level
{"type": "depth_slice", "depth_index": 0, "depth_m": 0, "values": [[28.3, 28.1, ...], ...]}
{"type": "depth_slice", "depth_index": 1, "depth_m": 5, "values": [[27.9, 27.7, ...], ...]}
...

// Final line
{"type": "complete", "total_depth_slices": 15}
```

`values` is a `latitudes × longitudes` 2-D array. `null` = masked/no data. Values are **float16** precision (~3 sig. figs.).

For `/predict`, the `metadata` chunk also contains:
```jsonc
"model_status": "success", "target_date": "...", "source_reference_date": "...", "inference_start_ms": 12
```
And `complete` also contains `"total_inference_ms"`.

If no data is found the stream emits a single error line (no separate HTTP error code):
```jsonc
{"type": "error", "status_code": 404, "detail": "..."}
```

---

## Health

```bash
curl http://localhost:8000/health
```
```json
{"status": "ok"}
```

---

## Metadata

```bash
# Grid bounds and step
curl http://localhost:8000/api/v1/metadata/bounds

# Supported depth levels (metres)
curl http://localhost:8000/api/v1/metadata/depths

# Date range available in the database
curl http://localhost:8000/api/v1/metadata/available-dates
```

---

## Historical Temperature Cube

### Full grid (all 15 depths, 101×241)
```bash
curl -N "http://localhost:8000/api/v1/ocean/historical?date=2020-01-15"
```

### Bounding box + specific depths
```bash
curl -N "http://localhost:8000/api/v1/ocean/historical?date=2020-01-15&lat_min=10&lat_max=20&lon_min=60&lon_max=80&depths=0,50,100"
```

### Single point query (all depths at one coordinate)
```bash
curl -N "http://localhost:8000/api/v1/ocean/historical?date=2020-01-15&lat=12.5&lon=67.0"
```

### Quick test — tiny slice (fast response for debugging)
```bash
curl -N "http://localhost:8000/api/v1/ocean/historical?date=2020-01-15&lat_min=10&lat_max=10.25&lon_min=60&lon_max=60.25&depths=0"
```

#### Query parameters
| Param | Type | Default | Description |
|---|---|---|---|
| `date` | `YYYY-MM-DD` | **required** | Target date |
| `lat_min` | float | 5.0 | South bound |
| `lat_max` | float | 30.0 | North bound |
| `lon_min` | float | 45.0 | West bound |
| `lon_max` | float | 105.0 | East bound |
| `depths` | string | all | Comma-separated depth levels e.g. `0,50,100` |
| `lat` | float | — | Point query — overrides bbox |
| `lon` | float | — | Point query — overrides bbox |

---

## Predict

Returns the same NDJSON stream as `/historical` with model metadata injected.  
The mock backend returns a randomly selected historical date as the "prediction".

### Option A — JSON body (programmatic)

```bash
curl -N -X POST http://localhost:8000/api/v1/ocean/predict \
  -H "Content-Type: application/json" \
  -d @sample_prediction_payload.json
```

`surface_observations` accepts either:
- **Named dict**: `{"sst_c": [[...], ...], "sss_psu": [[...], ...], ...}` — 7 keys, each `[101][241]`
- **3-D tensor**: `[[[...], ...], ...]` — shape `[7][101][241]`

Cell values: `float | int | null`. Float16-range values are accepted.

### Option B — Long-format CSV (multipart upload)

```bash
curl -N -X POST http://localhost:8000/api/v1/ocean/predict \
  -F "target_date=2024-06-15" \
  -F "observations=@your_observations.csv"
```

CSV format (`feature,lat,lon,value`):
```
feature,lat,lon,value
sst_c,12.5,67.0,28.3
sst_c,12.5,67.25,28.1
sss_psu,12.5,67.0,35.1
...
```
- Missing grid cells default to `null`
- lat/lon are snapped to the nearest 0.25° grid point (±0.125° tolerance)
- Unknown features and out-of-grid rows are silently skipped

#### Required features
`sst_c`, `sss_psu`, `sla_m`, `u_current_ms`, `v_current_ms`, `u_wind_ms`, `v_wind_ms`

---

## Swagger UI

Open **http://localhost:8000/docs** for interactive documentation.

> For `/predict`, paste your JSON body into the editor.  
> For the full-grid historical endpoint use the quick-test bounding box above — Swagger buffers the full stream before displaying, so a large bounding box will be slow.

---

## Grid Reference

| Dimension | Range | Step | Count |
|---|---|---|---|
| Latitude | 5.0 → 30.0 °N | 0.25° | 101 |
| Longitude | 45.0 → 105.0 °E | 0.25° | 241 |
| Depth | 0 → 1000 m | variable | 15 |

**Valid depth levels (metres):** `0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000`
