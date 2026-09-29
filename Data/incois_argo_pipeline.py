#!/usr/bin/env python3
import argparse
import io
import os
import warnings
import urllib3
import requests
import numpy as np
import pandas as pd
import xarray as xr
from scipy.interpolate import interp1d
from tqdm import tqdm

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
warnings.filterwarnings("ignore")

BBOX = {
    "min_lon": 45.0,
    "max_lon": 105.0,
    "min_lat": 5.0,
    "max_lat": 30.0,
    "min_depth": 0.0,
    "max_depth": 1100.0
}

# Exact 15 depths matching OceanEmbed and Data/ocean_mask_3d.nc
DEFAULT_15_DEPTHS = np.array(
    [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000],
    dtype=np.float32
)


def load_target_grid(reference_nc: str = "Data/ocean_mask_3d.nc"):
    if reference_nc and os.path.exists(reference_nc):
        print(f"[Grid] Loading exact 15-depth grid coordinates from: {reference_nc}")
        with xr.open_dataset(reference_nc) as ds:
            lat_name = next(c for c in ["latitude", "lat", "y"] if c in ds.coords or c in ds.dims)
            lon_name = next(c for c in ["longitude", "lon", "x"] if c in ds.coords or c in ds.dims)
            dep_name = next(c for c in ["depth", "lev", "z", "pres"] if c in ds.coords or c in ds.dims)
            lats = ds[lat_name].values.astype(np.float32)
            lons = ds[lon_name].values.astype(np.float32)
            depths = ds[dep_name].values.astype(np.float32)
            return depths, lats, lons, dep_name, lat_name, lon_name
    else:
        print("[Grid] Using default 15-depth 0.25° North Indian Ocean grid (100x240).")
        lats = np.linspace(5.125, 29.875, 100, dtype=np.float32)
        lons = np.linspace(45.125, 104.875, 240, dtype=np.float32)
        return DEFAULT_15_DEPTHS, lats, lons, "depth", "latitude", "longitude"


def download_month_argo_df(s_date: pd.Timestamp, e_date: pd.Timestamp) -> pd.DataFrame:
    """
    Tries INCOIS ERDDAP (uppercase schema) first, then Global GDAC Ifremer ERDDAP (lowercase schema).
    Uses requests(verify=False) so SSL issues never drop data.
    """
    t_start = s_date.strftime("%Y-%m-%dT00:00:00Z")
    t_end = e_date.strftime("%Y-%m-%dT00:00:00Z")

    endpoints = [
        # 1. Primary: Global GDAC Argo ERDDAP (Fast, includes all INCOIS Indian Ocean floats)
        (
            "https://erddap.ifremer.fr/erddap/tabledap/ArgoFloats.csv"
            f"?platform_number,cycle_number,time,latitude,longitude,"
            f"pres,pres_qc,pres_adjusted,pres_adjusted_qc,"
            f"temp,temp_qc,temp_adjusted,temp_adjusted_qc"
            f"&time>={t_start}&time<{t_end}"
            f"&latitude>={BBOX['min_lat']}&latitude<={BBOX['max_lat']}"
            f"&longitude>={BBOX['min_lon']}&longitude<={BBOX['max_lon']}"
            f"&pres>=0&pres<=1100"
        ),
        # 2. Secondary: INCOIS ERDDAP (Uppercase variable schema)
        (
            "https://erddap.incois.gov.in/erddap/tabledap/Indian_ARGO_Floats.csv"
            f"?PLATFORM_NUMBER,CYCLE_NUMBER,time,latitude,longitude,"
            f"PRES,PRES_QC,PRES_ADJUSTED,PRES_ADJUSTED_QC,"
            f"TEMP,TEMP_QC,TEMP_ADJUSTED,TEMP_ADJUSTED_QC"
            f"&time>={t_start}&time<{t_end}"
            f"&latitude>={BBOX['min_lat']}&latitude<={BBOX['max_lat']}"
            f"&longitude>={BBOX['min_lon']}&longitude<={BBOX['max_lon']}"
            f"&PRES>=0&PRES<=1100"
        ),
    ]

    for url in endpoints:
        try:
            resp = requests.get(url, timeout=45, verify=False)
            if resp.status_code != 200 or len(resp.text.splitlines()) <= 2:
                continue

            df = pd.read_csv(io.StringIO(resp.text), skiprows=[1], low_memory=False)
            if df.empty:
                continue

            # Standardize all column names to lowercase
            df.columns = [c.strip().lower() for c in df.columns]

            # Convert numeric columns safely
            for num_col in ["latitude", "longitude", "pres", "pres_adjusted", "temp", "temp_adjusted"]:
                if num_col in df.columns:
                    df[num_col] = pd.to_numeric(df[num_col], errors="coerce")

            # Clean QC strings ('1', '1.0', etc.)
            for qc_col in ["pres_qc", "pres_adjusted_qc", "temp_qc", "temp_adjusted_qc"]:
                if qc_col in df.columns:
                    df[qc_col] = df[qc_col].astype(str).str.strip().str.replace(".0", "", regex=False)

            # Prefer adjusted values when QC is good ('1' or '2'), otherwise fallback to raw real-time ('1' or '2')
            good_adj = (
                df["temp_adjusted"].notna() &
                df["pres_adjusted"].notna() &
                df["temp_adjusted_qc"].isin(["1", "2"]) &
                df["pres_adjusted_qc"].isin(["1", "2"])
            )
            good_raw = (
                df["temp"].notna() &
                df["pres"].notna() &
                df["temp_qc"].isin(["1", "2"]) &
                df["pres_qc"].isin(["1", "2"])
            )

            df["final_temp"] = np.where(good_adj, df["temp_adjusted"], np.where(good_raw, df["temp"], np.nan))
            df["final_pres"] = np.where(good_adj, df["pres_adjusted"], np.where(good_raw, df["pres"], np.nan))

            df = df.dropna(subset=["final_temp", "final_pres", "latitude", "longitude", "time"])
            df = df[(df["final_temp"] >= -2.0) & (df["final_temp"] <= 40.0)]

            if not df.empty:
                return df
        except Exception:
            continue

    return pd.DataFrame()


def build_argo_eval_dataset(
    start_year: int, end_year: int,
    target_depths: np.ndarray, target_lats: np.ndarray, target_lons: np.ndarray,
    cache_dir: str, days_axis: pd.DatetimeIndex
) -> xr.Dataset:
    n_days, n_depths, n_lats, n_lons = len(days_axis), len(target_depths), len(target_lats), len(target_lons)
    sum_grid = np.zeros((n_days, n_depths, n_lats, n_lons), dtype=np.float64)
    count_grid = np.zeros((n_days, n_depths, n_lats, n_lons), dtype=np.int32)

    for yr in range(start_year, end_year + 1):
        for month in tqdm(range(1, 13), desc=f"Fetching ARGO Profiles ({yr})", unit="mo"):
            s_date = pd.Timestamp(yr, month, 1)
            e_date = s_date + pd.offsets.MonthBegin(1)
            cache_f = os.path.join(cache_dir, f"argo_valid_{yr}_{month:02d}.parquet")

            df = pd.DataFrame()
            if os.path.exists(cache_f):
                try:
                    df = pd.read_parquet(cache_f)
                except Exception:
                    df = pd.DataFrame()

            if df.empty or "final_temp" not in df.columns:
                df = download_month_argo_df(s_date, e_date)
                if not df.empty:
                    df.to_parquet(cache_f, index=False)

            if df.empty:
                continue

            for (_, _), grp in df.groupby(["platform_number", "cycle_number"]):
                t_stamp = pd.to_datetime(grp["time"].iloc[0]).tz_localize(None).floor("D")
                d_idx = (t_stamp - days_axis[0]).days
                if not (0 <= d_idx < n_days):
                    continue

                lat_i = int(np.argmin(np.abs(target_lats - float(grp["latitude"].iloc[0]))))
                lon_i = int(np.argmin(np.abs(target_lons - float(grp["longitude"].iloc[0]))))

                z = grp["final_pres"].values.astype(np.float32) * 0.99  # dbar -> depth (m)
                t = grp["final_temp"].values.astype(np.float32)
                if len(z) < 2:
                    continue

                order = np.argsort(z)
                z_u, u_idx = np.unique(z[order], return_index=True)
                t_u = t[order][u_idx]
                if len(z_u) < 2:
                    continue

                f_i = interp1d(z_u, t_u, kind="linear", bounds_error=False, fill_value=np.nan)
                t_interp = f_i(target_depths)
                # Carry shallowest float reading (<= 15m) up to surface levels (0m, 5m, 10m)
                if z_u[0] <= 15.0:
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
            "thetao": (["time", "depth", "latitude", "longitude"], out_thetao),
            "argo_obs_mask": (["time", "depth", "latitude", "longitude"], mask.astype(np.uint8))
        },
        coords={"time": days_axis, "depth": target_depths, "latitude": target_lats, "longitude": target_lons}
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--start-year", type=int, default=2022)
    parser.add_argument("--end-year", type=int, default=2024)
    parser.add_argument("--reference-nc", type=str, default="Data/ocean_mask_3d.nc")
    parser.add_argument("--features-nc", type=str, default="Data/features_normalized.nc")
    parser.add_argument("--output-path", type=str, default="Data/incois_argo_thetao_2022_2024_eval.nc")
    args = parser.parse_args()

    cache_dir = os.path.join(os.path.dirname(args.output_path) or ".", ".argo_cache")
    os.makedirs(cache_dir, exist_ok=True)

    target_depths, target_lats, target_lons, _, _, _ = load_target_grid(args.reference_nc)

    # Match exact timestamps of features_normalized.nc if available
    if os.path.exists(args.features_nc):
        with xr.open_dataset(args.features_nc) as f_ds:
            days_axis = pd.to_datetime(f_ds.time.values)
        print(f"[Time] Matched exact {len(days_axis)} timestamps from {args.features_nc}")
    else:
        days_axis = pd.date_range(f"{args.start_year}-01-01", f"{args.end_year}-12-31", freq="D")

    ds_final = build_argo_eval_dataset(
        args.start_year, args.end_year,
        target_depths, target_lats, target_lons, cache_dir, days_axis
    )

    encoding = {
        "thetao": {"zlib": True, "complevel": 4, "dtype": "float32", "_FillValue": np.nan},
        "argo_obs_mask": {"zlib": True, "complevel": 4, "dtype": "uint8"}
    }
    ds_final.to_netcdf(args.output_path, encoding=encoding)
    print("=" * 70)
    print(f"[SUCCESS] Saved to: {args.output_path}")
    print(f"  -> Tensor Shape : {ds_final['thetao'].shape}")
    print(f"  -> Non-NaN Float Measurements: {int(ds_final['argo_obs_mask'].sum()):,}")
    print("=" * 70)


if __name__ == "__main__":
    main()