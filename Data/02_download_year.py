#!/usr/bin/env python3
"""
02_download_year.py: Resumable, atomic yearly downloader for Copernicus datasets.
Usage:
    python 02_download_year.py --year 2022
"""

import argparse
import os
import shutil
import sys
import tempfile
import pandas as pd
import xarray as xr
from tqdm import tqdm
import copernicusmarine

d_year = 2000

# Bounding box & depth configurations
BBOX = {
    "min_lon": 45.0,
    "max_lon": 105.0,
    "min_lat": 5.0,
    "max_lat": 30.0,
    "min_depth": 0.49,
    "max_depth": 1062.0
}

DATASET_CONFIG = {
    "dataset_id": "cmems_mod_glo_phy_my_0.083deg_P1D-m",
    "variables": ["thetao"]
}

def is_netcdf_valid(filepath: str) -> bool:
    """Verifies that a NetCDF file is fully intact and readable."""
    if not os.path.exists(filepath):
        return False
    try:
        with xr.open_dataset(filepath) as ds:
            # Check if key dimensions and variables exist
            if "thetao" in ds.data_vars and len(ds.time) > 0:
                return True
        return False
    except Exception:
        return False

def download_month(year: int, month: int, output_dir: str, temp_dir: str) -> bool:
    """Downloads one month atomically and validates before moving to output_dir."""
    month_str = f"{month:02d}"
    final_filename = f"glorys_thetao_{year}_{month_str}.nc"
    final_filepath = os.path.join(output_dir, final_filename)

    # 1. Skip if file already exists and is uncorrupted
    if is_netcdf_valid(final_filepath):
        tqdm.write(f"[{year}-{month_str}] Already downloaded and valid. Skipping.")
        return True

    # 2. Determine start and end timestamps
    start_date = pd.Timestamp(year, month, 1, 0, 0, 0)
    end_date = start_date + pd.offsets.MonthEnd(1) + pd.Timedelta(hours=23, minutes=59, seconds=59)

    start_str = start_date.strftime("%Y-%m-%d %H:%M:%S")
    end_str = end_date.strftime("%Y-%m-%d %H:%M:%S")

    temp_filepath = os.path.join(temp_dir, f"temp_{final_filename}")

    # Remove lingering temp file from previous failed run if present
    if os.path.exists(temp_filepath):
        os.remove(temp_filepath)

    tqdm.write(f"[{year}-{month_str}] Slicing & Downloading ({start_str} to {end_str})...")

    try:
        # Download into the temporary directory
        copernicusmarine.subset(
            dataset_id=DATASET_CONFIG["dataset_id"],
            variables=DATASET_CONFIG["variables"],
            minimum_longitude=BBOX["min_lon"],
            maximum_longitude=BBOX["max_lon"],
            minimum_latitude=BBOX["min_lat"],
            maximum_latitude=BBOX["max_lat"],
            minimum_depth=BBOX["min_depth"],
            maximum_depth=BBOX["max_depth"],
            start_datetime=start_str,
            end_datetime=end_str,
            output_filename=f"temp_{final_filename}",
            output_directory=temp_dir
        )

        # 3. Validate the downloaded file before saving to output folder
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
    parser = argparse.ArgumentParser(description="Resumable yearly ocean dataset downloader.")
    parser.add_argument("--year", type=int, default=d_year, help="Year to download (e.g., 2022)")
    parser.add_argument("--output-dir", type=str, default="glorys_data", help="Output directory path")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)
    temp_dir = os.path.join(args.output_dir, ".tmp")
    os.makedirs(temp_dir, exist_ok=True)

    print("=" * 60)
    print(f"STARTING DOWNLOAD PIPELINE FOR YEAR: {args.year}")
    print(f"Output Directory: {os.path.abspath(args.output_dir)}")
    print("=" * 60)

    # Tracking arrays
    successful_months = []
    failed_months = []
    remaining_months = list(range(1, 13))

    try:
        # Loop through all 12 months with progress bar
        for month in tqdm(range(1, 13), desc=f"Year {args.year} Progress", unit="month"):
            success = download_month(args.year, month, args.output_dir, temp_dir)
            
            # Update tracking arrays
            remaining_months.remove(month)
            if success:
                successful_months.append(month)
            else:
                failed_months.append(month)

    except KeyboardInterrupt:
        # Graceful exit block triggered by Ctrl+C
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
        # Always clean up the temporary directory, even if interrupted
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)

    # This only runs if the loop finishes without an interrupt
    print("\n" + "=" * 60)
    if not failed_months:
        print(f"[COMPLETED] All 12 months for {args.year} successfully downloaded!")
    else:
        print(f"[INCOMPLETE] Failed months for {args.year}: {failed_months}")
        print("Run the script again to automatically resume and download missing months.")
    print("=" * 60)

if __name__ == "__main__":
    main()