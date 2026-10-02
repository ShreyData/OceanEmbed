#!/usr/bin/env python3
"""
Create demo NetCDF for OceanEmbed frontend.
Extracts Jan 1-11, 2022 from raw monthly ocean data sources.
"""
import os
from pathlib import Path
import xarray as xr

BASE_DIR = Path("/mnt/Data/SIH 2k26")
RAW_DIR  = BASE_DIR / "data_pipeline" / "data" / "raw"
OUT_DIR  = BASE_DIR / "frontend" / "public"
OUT_FILE = OUT_DIR / "demo_ocean_11day.nc"

SOURCES = [
    ("SST",      RAW_DIR / "sst/SST/sst_input_01_2022.nc",              ["analysed_sst"]),
    ("SSH",      RAW_DIR / "ssh/SSH/ssh_input_01_2022.nc",              ["sla"]),
    ("SSS",      RAW_DIR / "sss/SSS/sss_input_01_2022.nc",              ["sos"]),
    ("Currents", RAW_DIR / "currents/Currents/currents_input_01_2022.nc", ["u", "v"]),
    ("Winds",    RAW_DIR / "winds/Winds/winds_input_01_2022.nc",         ["uwnd", "vwnd"]),
]

TARGET_VARS = ["analysed_sst", "sos", "sla", "uwnd", "vwnd", "u", "v"]

OUT_DIR.mkdir(parents=True, exist_ok=True)
arrays = {}
ref_time = ref_lat = ref_lon = None

for name, path, vars_ in SOURCES:
    print(f"Reading {name} from {path.name}...")
    ds = xr.open_dataset(path).isel(time=slice(0, 11))
    if ref_lat is None:
        ref_time = ds["time"]
        ref_lat  = ds["latitude"]
        ref_lon  = ds["longitude"]
    for v in vars_:
        da = ds[v].copy()
        assert da.shape == (11, 100, 240), f"{v} shape mismatch: {da.shape}"
        arrays[v] = da
        print(f"  {v}: shape={da.shape}, min={float(da.min()):.3f}, max={float(da.max()):.3f}")

# Build dataset in canonical variable order
demo_ds = xr.Dataset(
    {v: arrays[v] for v in TARGET_VARS},
    coords={"time": ref_time, "latitude": ref_lat, "longitude": ref_lon},
    attrs={
        "description": "OceanEmbed Demo: North Indian Ocean, 2022-01-01 to 2022-01-11",
        "source": "CMEMS/Copernicus Copernicus Marine Service raw data",
        "created_by": "OceanEmbed SIH 2026",
        "lat_range": "5.0N to 29.75N",
        "lon_range": "45.0E to 104.75E",
        "variables": "analysed_sst, sos, sla, uwnd, vwnd, u, v",
        "time_steps": "11 (days 1-11 January 2022)",
    }
)

enc = {v: {"zlib": True, "complevel": 5} for v in demo_ds.data_vars}
print(f"\nWriting to {OUT_FILE}...")
demo_ds.to_netcdf(OUT_FILE, encoding=enc)

sz = OUT_FILE.stat().st_size / (1024 * 1024)
print(f"Done! Size: {sz:.2f} MB")

# Verify
vds = xr.open_dataset(OUT_FILE)
print(f"Verified dims: {dict(vds.dims)}, vars: {list(vds.data_vars)}")
