#!/usr/bin/env python3
"""
incois_argo_pipeline.py: Automated downloader, cleaner, and 4D NaN-grid aligner
for INCOIS Live Access Server (LAS) Gridded ARGO & INCOIS ERDDAP data (2022-2024).

Usage (Auto-download from INCOIS):
    python incois_argo_pipeline.py --start-year 2022 --end-year 2024 --reference-nc /path/to/glorys_targets.nc

Usage (If you manually exported a raw .nc file from https://las.incois.gov.in/las/):
    python incois_argo_pipeline.py --local-raw-nc /path/to/las_export.nc --reference-nc /path/to/glorys_targets.nc
"""

import argparse
import os
import sys
import warnings
import xml.etree.ElementTree as ET
import urllib3
import requests
import numpy as np
import pandas as pd
import xarray as xr
from scipy.interpolate import interp1d
from tqdm import tqdm

# Suppress SSL warnings common on .gov.in portals
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
warnings.filterwarnings("ignore")

# North Indian Ocean Bounding Box (matching OceanEmbed domain)
BBOX = {
    "min_lon": 45.0,
    "max_lon": 105.0,
    "min_lat": 5.0,
    "max_lat": 30.0,
    "min_depth": 0.0,
    "max_depth": 1100.0
}

DEFAULT_DEPTHS = np.array([0.494, 10.0, 50.0, 100.0, 200.0, 500.0, 1062.0], dtype=np.float32)

INCOIS_LAS_CATALOG_URL = "https://las.incois.gov.in/thredds/catalog/las/catalog.xml"
INCOIS_THREDDS_BASE = "https://las.incois.gov.in/thredds/dodsC/"
INCOIS_ERDDAP_TABLEDAP = "https://erddap.incois.gov.in/erddap/tabledap/Indian_ARGO_Floats.csv"


def load_target_grid(reference_nc: str = None):
    """Loads exact (depth, lat, lon) coordinates from your GLORYS target NetCDF."""
    if reference_nc and os.path.exists(reference_nc):
        print(f"[Grid] Loading exact target grid coordinates from: {reference_nc}")
        with xr.open_dataset(reference_nc) as ds:
            lat_name = next(c for c in ["lat", "latitude", "y"] if c in ds.coords or c in ds.dims)
            lon_name = next(c for c in ["lon", "longitude", "x"] if c in ds.coords or c in ds.dims)
            dep_name = next(c for c in ["depth", "lev", "z", "pres"] if c in ds.coords or c in ds.dims)
            lats = ds[lat_name].values.astype(np.float32)
            lons = ds[lon_name].values.astype(np.float32)
            depths = ds[dep_name].values.astype(np.float32)
            return depths, lats, lons, dep_name, lat_name, lon_name
    else:
        print("[Grid] Using default 0.25° North Indian Ocean grid (100x240).")
        lats = np.linspace(5.125, 29.875, 100, dtype=np.float32)
        lons = np.linspace(45.125, 104.875, 240, dtype=np.float32)
        return DEFAULT_DEPTHS, lats, lons, "depth", "lat", "lon"


def discover_incois_las_argo_urls() -> list:
    """Crawls INCOIS LAS THREDDS XML catalog to discover active Gridded ARGO OPeNDAP endpoints."""
    print(f"[INCOIS LAS] Scanning THREDDS catalog: {INCOIS_LAS_CATALOG_URL} ...")
    found_urls = []
    try:
        resp = requests.get(INCOIS_LAS_CATALOG_URL, timeout=20, verify=False)
        resp.raise_for_status()
        root = ET.fromstring(resp.content)

        # Find all catalogRef links inside the master LAS catalog
        for elem in root.iter():
            if elem.tag.endswith("catalogRef"):
                href = elem.attrib.get("{http://www.w3.org/1999/xlink}href", "")
                title = elem.attrib.get("{http://www.w3.org/1999/xlink}title", "")
                sub_url = f"https://las.incois.gov.in/thredds/catalog/las/{href}"
                try:
                    sub_resp = requests.get(sub_url, timeout=10, verify=False)
                    if "argo" in sub_resp.text.lower():
                        sub_root = ET.fromstring(sub_resp.content)
                        for ds_elem in sub_root.iter():
                            if ds_elem.tag.endswith("dataset") and "urlPath" in ds_elem.attrib:
                                url_path = ds_elem.attrib["urlPath"]
                                if "argo" in url_path.lower() and ("temp" in url_path.lower() or "grid" in url_path.lower() or ".nc" in url_path.lower()):
                                    dods_url = INCOIS_THREDDS_BASE + url_path
                                    found_urls.append(dods_url)
                except Exception:
                    continue
    except Exception as e:
        print(f"[INCOIS LAS] Catalog scan warning: {e}")

    return found_urls


def clean_and_standardize_las_dataset(ds: xr.Dataset, start_year: int, end_year: int) -> xr.Dataset:
    """
    Cleans raw INCOIS LAS Gridded ARGO xarray Dataset:
    - Identifies temperature variable & standardizes coord names
    - Replaces Ferret/LAS fill values (-1e34, -999, etc.) with np.nan
    - Slices to North Indian Ocean BBOX and target years
    """
    # 1. Identify coordinate names dynamically
    lat_col = next(c for c in ds.coords if c.lower().startswith(("lat", "y")))
    lon_col = next(c for c in ds.coords if c.lower().startswith(("lon", "x")))
    dep_col = next(c for c in ds.coords if c.lower().startswith(("dep", "lev", "pres", "z")))
    time_col = next(c for c in ds.coords if c.lower().startswith(("tim", "t")))

    # 2. Identify temperature variable
    temp_candidates = [v for v in ds.data_vars if any(k in v.lower() for k in ["temp", "thetao", "t_an", "ptemp"])]
    if not temp_candidates:
        temp_candidates = list(ds.data_vars)
    temp_var = temp_candidates[0]
    print(f"[LAS Clean] Detected Temperature Variable: '{temp_var}' | Coords: ({time_col}, {dep_col}, {lat_col}, {lon_col})")

    da = ds[temp_var].rename({time_col: "time", dep_col: "depth", lat_col: "lat", lon_col: "lon"})
    da = da.transpose("time", "depth", "lat", "lon")

    # Ensure ascending coordinates before slicing
    for c in ["lat", "lon", "depth", "time"]:
        if da[c].values[0] > da[c].values[-1]:
            da = da.sortby(c)

    # 3. Subset spatial & temporal bounds
    da = da.sel(
        lon=slice(BBOX["min_lon"], BBOX["max_lon"]),
        lat=slice(BBOX["min_lat"], BBOX["max_lat"]),
        depth=slice(BBOX["min_depth"], BBOX["max_depth"]),
        time=slice(f"{start_year}-01-01", f"{end_year}-12-31")
    )

    # 4. Mask out Ferret/LAS fill values and unphysical temperatures (< -2°C or > 42°C)
    vals = da.values.astype(np.float32)
    invalid_mask = np.isnan(vals) | (vals < -2.0) | (vals > 42.0) | (np.abs(vals) > 900.0)
    vals[invalid_mask] = np.nan
    da.values = vals

    return da.to_dataset(name="thetao")


def align_las_grid_to_model_grid(
    ds_las: xr.Dataset,
    target_depths: np.ndarray,
    target_lats: np.ndarray,
    target_lons: np.ndarray,
    start_year: int,
    end_year: int,
    spatial_mode: str = "nearest_cell"
) -> xr.Dataset:
    """
    Maps cleaned INCOIS Gridded ARGO onto the exact 4D (time, depth, lat, lon) model grid.
    Leaves any unobserved day, pixel, or depth as np.nan so evaluation only happens on valid data.
    """
    days_axis = pd.date_range(f"{start_year}-01-01", f"{end_year}-12-31", freq="D")
    n_days, n_depths, n_lats, n_lons = len(days_axis), len(target_depths), len(target_lats), len(target_lons)

    # Step 1: Vertical Interpolation onto exact model depth levels
    las_depths = ds_las["depth"].values.astype(np.float32)
    las_vals = ds_las["thetao"].values  # (T_las, D_las, Lat_las, Lon_las)

    f_vert = interp1d(
        las_depths, las_vals, axis=1, kind="linear",
        bounds_error=False, fill_value=np.nan
    )
    vals_vert_aligned = f_vert(target_depths).astype(np.float32)

    # If shallowest LAS level is <= 10m (e.g. 5m) and model has 0.494m, copy surface value
    if las_depths[0] <= 10.0:
        shallow_idx = np.where(target_depths < las_depths[0])[0]
        for idx in shallow_idx:
            vals_vert_aligned[:, idx, :, :] = las_vals[:, 0, :, :]

    # Step 2: Horizontal & Temporal Placement into 4D NaN Tensor
    out_thetao = np.full((n_days, n_depths, n_lats, n_lons), np.nan, dtype=np.float32)

    las_lats = ds_las["lat"].values
    las_lons = ds_las["lon"].values
    las_times = pd.to_datetime(ds_las["time"].values).floor("D")

    # Map each LAS latitude/longitude to its nearest target 0.25° grid index
    lat_indices = [int(np.argmin(np.abs(target_lats - lat))) for lat in las_lats]
    lon_indices = [int(np.argmin(np.abs(target_lons - lon))) for lon in las_lons]

    lat_idx_grid, lon_idx_grid = np.meshgrid(lat_indices, lon_indices, indexing="ij")

    matched_steps = 0
    for t_i, t_val in enumerate(las_times):
        day_offset = (t_val - days_axis[0]).days
        if not (0 <= day_offset < n_days):
            continue

        slice_3d = vals_vert_aligned[t_i]  # (n_depths, Lat_las, Lon_las)
        if np.all(np.isnan(slice_3d)):
            continue

        if spatial_mode == "nearest_cell":
            # Place exact Gridded ARGO node values at their matching 0.25° cell; keep rest NaN
            out_thetao[day_offset, :, lat_idx_grid, lon_idx_grid] = np.transpose(slice_3d, (1, 2, 0))
        elif spatial_mode == "bilinear":
            # Optional: bilinearly interpolate across the 0.25° grid (still keeping land as NaN)
            da_step = xr.DataArray(
                slice_3d, coords=[target_depths, las_lats, las_lons], dims=["depth", "lat", "lon"]
            )
            out_thetao[day_offset] = da_step.interp(lat=target_lats, lon=target_lons, method="linear").values

        matched_steps += 1

    has_obs = ~np.isnan(out_thetao)
    print(f"[Align] Mapped {matched_steps} INCOIS time slices | Total valid 3D evaluation points: {int(np.sum(has_obs))}")

    return xr.Dataset(
        data_vars={
            "thetao": (["time", "depth", "lat", "lon"], out_thetao),
            "argo_obs_mask": (["time", "depth", "lat", "lon"], has_obs.astype(np.uint8))
        },
        coords={
            "time": days_axis,
            "depth": target_depths,
            "lat": target_lats,
            "lon": target_lons
        }
    )


def fetch_incois_erddap_fallback(
    start_year: int, end_year: int,
    target_depths: np.ndarray, target_lats: np.ndarray, target_lons: np.ndarray,
    cache_dir: str
) -> xr.Dataset:
    """
    Direct REST API downloader using pandas and requests. Zero argopy dependencies.
    """
    print("[INCOIS ERDDAP] Using direct ERDDAP REST API fallback for 2022-2024...")
    
    days_axis = pd.date_range(f"{start_year}-01-01", f"{end_year}-12-31", freq="D")
    n_days, n_depths, n_lats, n_lons = len(days_axis), len(target_depths), len(target_lats), len(target_lons)

    sum_grid = np.zeros((n_days, n_depths, n_lats, n_lons), dtype=np.float64)
    count_grid = np.zeros((n_days, n_depths, n_lats, n_lons), dtype=np.int32)

    for yr in range(start_year, end_year + 1):
        for month in tqdm(range(1, 13), desc=f"Downloading ARGO ({yr})", unit="mo"):
            s_date = pd.Timestamp(yr, month, 1)
            e_date = s_date + pd.offsets.MonthBegin(1)
            cache_f = os.path.join(cache_dir, f"incois_argo_rest_{yr}_{month:02d}.parquet")

            if os.path.exists(cache_f):
                df = pd.read_parquet(cache_f)
            else:
                base_url = "https://erddap.incois.gov.in/erddap/tabledap/Indian_ARGO_Floats.csv"
                query_params = (
                    f"?platform_number,cycle_number,time,latitude,longitude,pres_adjusted,temp_adjusted,"
                    f"data_mode,temp_adjusted_qc,pres_adjusted_qc,position_qc"
                    f"&time>={s_date.strftime('%Y-%m-%dT00:00:00Z')}"
                    f"&time<{e_date.strftime('%Y-%m-%dT00:00:00Z')}"
                    f"&latitude>={BBOX['min_lat']}&latitude<={BBOX['max_lat']}"
                    f"&longitude>={BBOX['min_lon']}&longitude<={BBOX['max_lon']}"
                    f"&pres_adjusted>=0&pres_adjusted<=1100"
                )
                target_url = base_url + query_params
                
                try:
                    df = pd.read_csv(target_url, skiprows=[1]) # ERDDAP puts units on row 2
                    if df.empty:
                        continue
                        
                    df.columns = [c.strip().lower() for c in df.columns]
                    for c in ["data_mode", "temp_adjusted_qc", "pres_adjusted_qc"]:
                        if c in df.columns:
                            df[c] = df[c].astype(str).str.strip()
                            
                    df = df[
                        (df["data_mode"].isin(["D", "A"])) &
                        (df["temp_adjusted_qc"] == "1") &
                        (df["pres_adjusted_qc"] == "1")
                    ].dropna(subset=["temp_adjusted", "pres_adjusted", "latitude", "longitude", "time"])
                    
                    df.to_parquet(cache_f, index=False)
                except Exception as e:
                    tqdm.write(f"ERDDAP query warning for {yr}-{month:02d}: {e}")
                    continue

            if df.empty:
                continue

            for (_, _), grp in df.groupby(["platform_number", "cycle_number"]):
                d_idx = (pd.to_datetime(grp["time"].iloc[0]).floor("D") - days_axis[0]).days
                if not (0 <= d_idx < n_days):
                    continue
                lat_i = int(np.argmin(np.abs(target_lats - float(grp["latitude"].iloc[0]))))
                lon_i = int(np.argmin(np.abs(target_lons - float(grp["longitude"].iloc[0]))))

                z = grp["pres_adjusted"].values.astype(np.float32) * 0.99  # dbar to meters approx
                t = grp["temp_adjusted"].values.astype(np.float32)
                if len(z) < 2:
                    continue
                order = np.argsort(z)
                z_u, u_idx = np.unique(z[order], return_index=True)
                t_u = t[order][u_idx]
                if len(z_u) < 2:
                    continue
                
                f_i = interp1d(z_u, t_u, kind="linear", bounds_error=False, fill_value=np.nan)
                t_interp = f_i(target_depths)
                if z_u[0] <= 10.0:
                    t_interp[target_depths < z_u[0]] = t_u[0]

                valid = ~np.isnan(t_interp)
                if np.any(valid):
                    sum_grid[d_idx, valid, lat_i, lon_i] += t_interp[valid]
                    count_grid[d_idx, valid, lat_i, lon_i] += 1

    out_thetao = np.full((n_days, n_depths, n_lats, n_lons), np.nan, dtype=np.float32)
    mask = count_grid > 0
    out_thetao[mask] = (sum_grid[mask] / count_grid[mask]).astype(np.float32)

    return xr.Dataset(
        data_vars={
            "thetao": (["time", "depth", "lat", "lon"], out_thetao),
            "argo_obs_mask": (["time", "depth", "lat", "lon"], mask.astype(np.uint8))
        },
        coords={"time": days_axis, "depth": target_depths, "lat": target_lats, "lon": target_lons}
    )


def main():
    parser = argparse.ArgumentParser(description="INCOIS LAS Gridded ARGO Downloader & 4D Formatter")
    parser.add_argument("--start-year", type=int, default=2022)
    parser.add_argument("--end-year", type=int, default=2024)
    parser.add_argument("--local-raw-nc", type=str, default=None,
                        help="Path to raw NetCDF file(s) downloaded manually from https://las.incois.gov.in/las/")
    parser.add_argument("--las-opendap-url", type=str, default=None,
                        help="Specific OPeNDAP URL from INCOIS LAS (if known)")
    parser.add_argument("--reference-nc", type=str, default=None,
                        help="Path to your processed GLORYS target .nc file to match exact coordinates")
    parser.add_argument("--spatial-mode", choices=["nearest_cell", "bilinear"], default="nearest_cell",
                        help="'nearest_cell' keeps NaN everywhere except exact LAS grid nodes; 'bilinear' interpolates")
    parser.add_argument("--output-dir", type=str, default="incois_argo_eval")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)
    cache_dir = os.path.join(args.output_dir, ".cache")
    os.makedirs(cache_dir, exist_ok=True)

    target_depths, target_lats, target_lons, dep_name, lat_name, lon_name = load_target_grid(args.reference_nc)

    ds_aligned = None

    # 1. If user provided a local raw NetCDF exported from INCOIS LAS Web UI
    if args.local_raw_nc and os.path.exists(args.local_raw_nc):
        print(f"[Input] Opening local INCOIS LAS NetCDF: {args.local_raw_nc}")
        ds_raw = xr.open_dataset(args.local_raw_nc, decode_times=True)
        ds_clean = clean_and_standardize_las_dataset(ds_raw, args.start_year, args.end_year)
        ds_aligned = align_las_grid_to_model_grid(
            ds_clean, target_depths, target_lats, target_lons,
            args.start_year, args.end_year, args.spatial_mode
        )

    # 2. Otherwise, try direct OPeNDAP URL or auto-discover from INCOIS LAS THREDDS Catalog
    else:
        urls_to_try = [args.las_opendap_url] if args.las_opendap_url else discover_incois_las_argo_urls()
        for url in urls_to_try:
            if not url:
                continue
            try:
                print(f"[INCOIS LAS] Attempting OPeNDAP connection: {url}")
                ds_raw = xr.open_dataset(url, decode_times=True)
                ds_clean = clean_and_standardize_las_dataset(ds_raw, args.start_year, args.end_year)
                if len(ds_clean.time) > 0:
                    ds_aligned = align_las_grid_to_model_grid(
                        ds_clean, target_depths, target_lats, target_lons,
                        args.start_year, args.end_year, args.spatial_mode
                    )
                    break
            except Exception as e:
                print(f"[INCOIS LAS] Could not slice {url}: {e}")

    # 3. Fallback if INCOIS LAS THREDDS blocks automated connection or stops before 2022
    if ds_aligned is None or int(ds_aligned["argo_obs_mask"].sum()) == 0:
        print("[Notice] Switching to automated profile gridding for 2022-2024...")
        ds_aligned = fetch_incois_erddap_fallback(
            args.start_year, args.end_year,
            target_depths, target_lats, target_lons, cache_dir
        )

    # Rename coordinates back to exact names expected by your PyTorch Dataset
    ds_final = ds_aligned.rename({"depth": dep_name, "lat": lat_name, "lon": lon_name})

    out_path = os.path.join(args.output_dir, f"incois_argo_thetao_{args.start_year}_{args.end_year}_eval.nc")
    encoding = {
        "thetao": {"zlib": True, "complevel": 4, "dtype": "float32", "_FillValue": np.nan},
        "argo_obs_mask": {"zlib": True, "complevel": 4, "dtype": "uint8"}
    }
    ds_final.to_netcdf(out_path, encoding=encoding)
    print("=" * 70)
    print(f"[SUCCESS] Evaluation-ready INCOIS ARGO NetCDF saved to:\n  -> {out_path}")
    print(f"  -> Tensor Shape: {ds_final['thetao'].shape} | Non-NaN Points: {int(ds_final['argo_obs_mask'].sum())}")
    print("=" * 70)


if __name__ == "__main__":
    main()