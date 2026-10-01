#!/usr/bin/env python3
"""
03_download_sst_year.py: Resumable, atomic yearly downloader for Copernicus SST dataset (010_011).
Usage:
    python 03_download_sst_year.py --year 2021
"""

import argparse
import os
import shutil
import sys
import pandas as pd
import xarray as xr
from tqdm import tqdm
import copernicusmarine

d_year = 2021

# Bounding box configurations (Surface only - no depth required)
BBOX = {
    "min_lon": 45.0,
    "max_lon": 105.0,
    "min_lat": 5.0,
    "max_lat": 30.0
}

DATASET_CONFIG = {
    "dataset_id": "METOFFICE-GLO-SST-L4-REP-OBS-SST",
    "variables": ["analysed_sst"]
}

def is_netcdf_valid(filepath: str) -> bool:
    """Verifies that the SST NetCDF file is fully intact, readable, and uncorrupted."""
    if not os.path.exists(filepath):
        return False
    try:
        with xr.open_dataset(filepath) as ds:
            if "analysed_sst" in ds.data_vars and len(ds.time) > 0:
                return True
        return False
    except Exception:
        return False

def download_month(year: int, month: int, output_dir: str, temp_dir: str) -> bool:
    """Downloads one month atomically and validates before saving to output directory."""
    # Updated to numeric month format (01, 02, etc.)
    month_str = f"{month:02d}"
    final_filename = f"sst_{month_str}_{year}.nc"
    final_filepath = os.path.join(output_dir, final_filename)

    # 1. Skip if already downloaded and valid
    if is_netcdf_valid(final_filepath):
        tqdm.write(f"[{year}-{month_str}] Already downloaded and valid. Skipping.")
        return True

    # 2. Compute start and end timestamps for the month
    start_date = pd.Timestamp(year, month, 1, 0, 0, 0)
    end_date = start_date + pd.offsets.MonthEnd(1) + pd.Timedelta(hours=23, minutes=59, seconds=59)

    start_str = start_date.strftime("%Y-%m-%d %H:%M:%S")
    end_str = end_date.strftime("%Y-%m-%d %H:%M:%S")

    temp_filepath = os.path.join(temp_dir, f"temp_{final_filename}")

    # Remove residual temp file from previous failed run if present
    if os.path.exists(temp_filepath):
        os.remove(temp_filepath)

    tqdm.write(f"[{year}-{month_str}] Slicing & Downloading ({start_str} to {end_str})...")

    try:
        # Download into temporary directory
        copernicusmarine.subset(
            dataset_id=DATASET_CONFIG["dataset_id"],
            variables=DATASET_CONFIG["variables"],
            minimum_longitude=BBOX["min_lon"],
            maximum_longitude=BBOX["max_lon"],
            minimum_latitude=BBOX["min_lat"],
            maximum_latitude=BBOX["max_lat"],
            start_datetime=start_str,
            end_datetime=end_str,
            output_filename=f"temp_{final_filename}",
            output_directory=temp_dir
        )

        # 3. Validate before moving to target folder
        if is_netcdf_valid(temp_filepath):
            shutil.move(temp_filepath, final_filepath)
            tqdm.write(f"[{year}-{month_str}] Successfully saved to {final_filepath}")
            return True
        else:
            tqdm.write(f"[{year}-{month_str}] [ERROR] Downloaded file corrupted or empty.")
            if os.path.exists(temp_filepath):
                os.remove(temp_filepath)
            return False

    except Exception as e:
        tqdm.write(f"[{year}-{month_str}] [EXCEPTION] {e}")
        if os.path.exists(temp_filepath):
            os.remove(temp_filepath)
        return False

def main():
    parser = argparse.ArgumentParser(description="Resumable yearly SST dataset downloader.")
    parser.add_argument("--year", type=int, default=d_year, help="Year to download (e.g., 2021)")
    parser.add_argument("--base-dir", type=str, default="data_pipeline/data/raw/sst/Down", help="Base output directory path")
    args = parser.parse_args()

    # Create target path: data_pipeline/data/raw/sst/Down/{year}/
    year_output_dir = os.path.join(args.base_dir, str(args.year))
    os.makedirs(year_output_dir, exist_ok=True)

    temp_dir = os.path.join(year_output_dir, ".tmp")
    os.makedirs(temp_dir, exist_ok=True)

    print("=" * 60)
    print(f"STARTING SST DOWNLOAD PIPELINE FOR YEAR: {args.year}")
    print(f"Target Directory: {os.path.abspath(year_output_dir)}")
    print("=" * 60)

    successful_months = []
    failed_months = []
    remaining_months = list(range(1, 13))

    try:
        for month in tqdm(range(1, 13), desc=f"Year {args.year} SST Progress", unit="month"):
            success = download_month(args.year, month, year_output_dir, temp_dir)

            remaining_months.remove(month)
            if success:
                successful_months.append(month)
            else:
                failed_months.append(month)

    except KeyboardInterrupt:
        print("\n\n" + "=" * 60)
        print("🛑 DOWNLOAD STOPPED (Manually Interrupted)")
        print("=" * 60)
        print(f"Downloaded -> {successful_months}")
        if failed_months:
            print(f"Failed     -> {failed_months}")
        print(f"Remaining  -> {remaining_months}")
        print("=" * 60)
        sys.exit(0)

    finally:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)

    print("\n" + "=" * 60)
    if not failed_months:
        print(f"[COMPLETED] All 12 months for {args.year} successfully downloaded!")
    else:
        print(f"[INCOMPLETE] Failed months for {args.year}: {failed_months}")
        print("Run the script again to automatically resume and download missing months.")
    print("=" * 60)

if __name__ == "__main__":
    main()