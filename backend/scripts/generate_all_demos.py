#!/usr/bin/env python3
"""
Generate 10 NetCDF demo datasets for OceanEmbed.
Extracts 11-day observation matrices across 2022-2024 (excluding month 12 of 2024)
matching available GLORYS and INCOIS ARGO ground truth dates.
"""
import os
import shutil
from pathlib import Path
import xarray as xr

BASE_DIR = Path("/mnt/Data/SIH 2k26")
RAW_DIR  = BASE_DIR / "data_pipeline" / "data" / "raw"
OUT_DIR  = BASE_DIR / "frontend" / "public" / "demos"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# 10 diverse seasons across 2022-2024
DEMO_CONFIGS = [
    {"year": "2022", "month": "01", "name": "demo_2022_01_11.nc", "season": "Winter Monsoon (Jan 2022)", "target_date": "2022-01-11"},
    {"year": "2022", "month": "04", "name": "demo_2022_04_11.nc", "season": "Spring Pre-Monsoon (Apr 2022)", "target_date": "2022-04-11"},
    {"year": "2022", "month": "07", "name": "demo_2022_07_11.nc", "season": "Southwest Summer Monsoon (Jul 2022)", "target_date": "2022-07-11"},
    {"year": "2022", "month": "10", "name": "demo_2022_10_11.nc", "season": "Post-Monsoon Transition (Oct 2022)", "target_date": "2022-10-11"},
    {"year": "2023", "month": "02", "name": "demo_2023_02_11.nc", "season": "Late Winter Stratification (Feb 2023)", "target_date": "2023-02-11"},
    {"year": "2023", "month": "05", "name": "demo_2023_05_11.nc", "season": "Pre-Monsoon Peak Warming (May 2023)", "target_date": "2023-05-11"},
    {"year": "2023", "month": "08", "name": "demo_2023_08_11.nc", "season": "Mid-Monsoon Wind Mixing (Aug 2023)", "target_date": "2023-08-11"},
    {"year": "2023", "month": "11", "name": "demo_2023_11_11.nc", "season": "Northeast Monsoon (Nov 2023)", "target_date": "2023-11-11"},
    {"year": "2024", "month": "03", "name": "demo_2024_03_11.nc", "season": "Spring Warming (Mar 2024)", "target_date": "2024-03-11"},
    {"year": "2024", "month": "10", "name": "demo_2024_10_11.nc", "season": "Autumn Post-Monsoon (Oct 2024)", "target_date": "2024-10-11"},
]

TARGET_VARS = ["analysed_sst", "sos", "sla", "uwnd", "vwnd", "u", "v"]

print(f"Starting generation of {len(DEMO_CONFIGS)} NetCDF demo inputs...")

manifest = []

for cfg in DEMO_CONFIGS:
    y = cfg["year"]
    m = cfg["month"]
    out_file = OUT_DIR / cfg["name"]

    sources = [
        ("SST",      RAW_DIR / f"sst/SST/sst_input_{m}_{y}.nc",              ["analysed_sst"]),
        ("SSH",      RAW_DIR / f"ssh/SSH/ssh_input_{m}_{y}.nc",              ["sla"]),
        ("SSS",      RAW_DIR / f"sss/SSS/sss_input_{m}_{y}.nc",              ["sos"]),
        ("Currents", RAW_DIR / f"currents/Currents/currents_input_{m}_{y}.nc", ["u", "v"]),
        ("Winds",    RAW_DIR / f"winds/Winds/winds_input_{m}_{y}.nc",         ["uwnd", "vwnd"]),
    ]

    print(f"\n--- Generating {cfg['name']} ({cfg['season']}) ---")
    arrays = {}
    ref_time = ref_lat = ref_lon = None

    for s_name, path, vars_ in sources:
        if not path.exists():
            raise FileNotFoundError(f"Missing raw file: {path}")
        ds = xr.open_dataset(path).isel(time=slice(0, 11))
        if ref_lat is None:
            ref_time = ds["time"]
            ref_lat  = ds["latitude"]
            ref_lon  = ds["longitude"]
        for v in vars_:
            da = ds[v].copy()
            assert da.shape == (11, 100, 240), f"{v} shape mismatch: {da.shape}"
            arrays[v] = da

    demo_ds = xr.Dataset(
        {v: arrays[v] for v in TARGET_VARS},
        coords={"time": ref_time, "latitude": ref_lat, "longitude": ref_lon},
        attrs={
            "description": f"OceanEmbed Demo: North Indian Ocean, {y}-{m}-01 to {cfg['target_date']}",
            "season": cfg["season"],
            "target_date": cfg["target_date"],
            "source": "CMEMS/Copernicus Marine Service raw data",
            "lat_range": "5.0N to 29.75N",
            "lon_range": "45.0E to 104.75E",
            "time_steps": f"11 days ({y}-{m}-01 to {cfg['target_date']})",
        }
    )

    enc = {v: {"zlib": True, "complevel": 5} for v in demo_ds.data_vars}
    demo_ds.to_netcdf(out_file, encoding=enc)
    sz_mb = out_file.stat().st_size / (1024 * 1024)
    print(f"Created {out_file.name} ({sz_mb:.2f} MB)")

    manifest.append({
        "id": cfg["name"].replace(".nc", ""),
        "filename": cfg["name"],
        "path": f"/demos/{cfg['name']}",
        "season": cfg["season"],
        "target_date": cfg["target_date"],
        "year": int(y),
        "month": int(m),
        "size_mb": round(sz_mb, 2)
    })

# Also copy first demo to default demo_ocean_11day.nc in public root
shutil.copyfile(OUT_DIR / "demo_2022_01_11.nc", BASE_DIR / "frontend" / "public" / "demo_ocean_11day.nc")
print("\nSynced default demo_ocean_11day.nc in frontend/public")

# Save manifest json for frontend dropdown
import json
manifest_path = BASE_DIR / "frontend" / "public" / "demos" / "demos_manifest.json"
with open(manifest_path, "w") as f:
    json.dump(manifest, f, indent=2)
print(f"Saved manifest to {manifest_path}")
print("ALL 10 DEMO NETCDF INPUTS GENERATED SUCCESSFULLY! 🎉")
