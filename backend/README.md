---
title: OceanEmbed Engine API
emoji: 🌊
colorFrom: blue
colorTo: cyan
sdk: docker
app_port: 7860
---

# OceanEmbed Engine API

Subsurface ocean temperature reconstruction from 11-day surface observation windows.

**Model:** OceanEmbed v2 (Dual-Branch U-Net + TS-Mixer + ConvLSTM + HASPP bottleneck)  
**Checkpoint:** `oceanembed_epoch_7.pth` (9.9 MB)  
**Grid:** North Indian Ocean — 5°N–29.75°N, 45°E–104.75°E (100×240, 0.25° resolution)  
**Output:** 15 subsurface depth levels (0–1000m) in °C

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | Liveness check + model status |
| `POST` | `/predict` | Upload 11-day `.nc` → 3D temperature prediction |

## `/predict` — Input Requirements

Upload a NetCDF (`.nc`) file via `multipart/form-data` with key `file`.

**Required variables:** `analysed_sst`, `sos`, `sla`, `uwnd`, `vwnd`, `u`, `v`  
**Time dimension:** exactly 11 timesteps (days 1–10 = history, day 11 = prediction target)  
**Spatial grid:** 100 latitude × 240 longitude points  
**Coverage:** 5.0°N–29.75°N, 45.0°E–104.75°E  

## Local Development

```bash
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 7860 --reload
```

## Docker (Hugging Face Spaces)

```bash
docker build -t oceanembed-backend .
docker run -p 7860:7860 oceanembed-backend
```

> **Note:** Place `oceanembed_epoch_7.pth` in the `checkpoints/` directory before building the Docker image.
