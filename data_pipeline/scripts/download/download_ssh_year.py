#!/usr/bin/env python3
"""
05_download_ssh_multi_year.py: Resumable, atomic multi-year downloader for Copernicus DUACS SSH (SLA only).
Usage:
    python 05_download_ssh_multi_year.py --year 2008 2022
"""

import argparse
import os
import shutil
import sys
import pandas as pd
import xarray as xr
from tqdm import tqdm
import copernicusmarine

# Bounding box configurations (Surface only)
BBOX = {
    "min_lon": 45.0,
    "max_lon": 105.0,
    "min_lat": 5.0,
    "max_lat": 30.0
}

DATASET_CONFIG = {
    "dataset_id": "cmems_obs-sl_glo_phy-ssh_my_allsat-l4-duacs-0.125deg_P1D",
    "variables": ["sla"]
}

def is_netcdf_valid(filepath: str) -> bool:
    """Verifies that the SSH NetCDF file is intact and contains the SLA variable."""
    if not os.path.exists(filepath):
        return False
    try:
        with xr.open_dataset(filepath) as ds:
            required_vars = ["sla"]
            if all(v in ds.data_vars for v in required_vars) and len(ds.time) > 0:
                return True
        return False
    except Exception:
        return False

def download_month(year: int, month: int, output_dir: str, temp_dir: str) -> bool:
    """Downloads one month atomically and validates before saving to target folder."""
    month_str = f"{month:02d}"
    final_filename = f"ssh_{month_str}_{year}.nc"
    final_filepath = os.path.join(output_dir, final_filename)

    # 1. Skip if already downloaded and verified
    if is_netcdf_valid(final_filepath):
        tqdm.write(f"[{year}-{month_str}] Already downloaded and valid. Skipping.")
        return True

    # 2. Compute timestamps for the full month
    start_date = pd.Timestamp(year, month, 1, 0, 0, 0)
    end_date = start_date + pd.offsets.MonthEnd(1) + pd.Timedelta(hours=23, minutes=59, seconds=59)

    start_str = start_date.strftime("%Y-%m-%d %H:%M:%S")
    end_str = end_date.strftime("%Y-%m-%d %H:%M:%S")

    temp_filepath = os.path.join(temp_dir, f"temp_{final_filename}")

    if os.path.exists(temp_filepath):
        os.remove(temp_filepath)

    tqdm.write(f"[{year}-{month_str}] Slicing & Downloading ({start_str} to {end_str})...")

    try:
        # Download into temporary staging directory
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

        # 3. Validate file integrity before permanent commit
        if is_netcdf_valid(temp_filepath):
            shutil.move(temp_filepath, final_filepath)
            tqdm.write(f"[{year}-{month_str}] Successfully saved to {final_filepath}")
            return True
        else:
            tqdm.write(f"[{year}-{month_str}] [ERROR] File corrupted, missing 'sla', or empty.")
            if os.path.exists(temp_filepath):
                os.remove(temp_filepath)
            return False

    except Exception as e:
        tqdm.write(f"[{year}-{month_str}] [EXCEPTION] {e}")
        if os.path.exists(temp_filepath):
            os.remove(temp_filepath)
        return False

def main():
    parser = argparse.ArgumentParser(description="Resumable multi-year SSH dataset downloader (SLA only).")
    # Using nargs=2 forces the user to provide exactly a start and end year
    parser.add_argument("--year", type=int, nargs=2, required=True, help="Start and end year to download (e.g., --year 2008 2022)")
    parser.add_argument("--base-dir", type=str, default="data_pipeline/data/raw/ssh/Down", help="Base output directory path")
    args = parser.parse_args()

    start_year, end_year = args.year

    if start_year > end_year:
        print("Error: The start year must be less than or equal to the end year.")
        sys.exit(1)

    print("=" * 60)
    print(f"STARTING DUACS SSH (SLA) PIPELINE FOR YEARS: {start_year} TO {end_year}")
    print(f"Base Target Directory: {os.path.abspath(args.base_dir)}")
    print("=" * 60)

    overall_failed = []

    try:
        # Outer loop for years
        for current_year in range(start_year, end_year + 1):
            year_output_dir = os.path.join(args.base_dir, str(current_year))
            os.makedirs(year_output_dir, exist_ok=True)

            temp_dir = os.path.join(year_output_dir, ".tmp")
            os.makedirs(temp_dir, exist_ok=True)
            
            print(f"\n---> Processing Year {current_year} <---")
            
            # Inner loop for months
            for month in tqdm(range(1, 13), desc=f"Year {current_year} SSH Progress", unit="month"):
                success = download_month(current_year, month, year_output_dir, temp_dir)
                
                if not success:
                    overall_failed.append(f"{current_year}-{month:02d}")
            
            # Clean up the temp directory after each year completes
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir, ignore_errors=True)

    except KeyboardInterrupt:
        print("\n\n" + "=" * 60)
        print("🛑 DOWNLOAD STOPPED (Manually Interrupted)")
        print("=" * 60)
        if overall_failed:
            print(f"Failed so far -> {overall_failed}")
        print("=" * 60)
        sys.exit(0)

    print("\n" + "=" * 60)
    if not overall_failed:
        print(f"[COMPLETED] All months from {start_year} to {end_year} successfully downloaded!")
    else:
        print(f"[INCOMPLETE] Failed months: {overall_failed}")
        print("Run the script again to automatically resume and download missing files.")
    print("=" * 60)

if __name__ == "__main__":
    main()