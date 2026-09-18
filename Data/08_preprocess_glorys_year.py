#!/usr/bin/env python3
"""
07_preprocess_glorys_year.py: Interpolates raw GLORYS thetao data to the standardized 100x240x15 tensor format.
Usage:
    python 07_preprocess_glorys_year.py --year 2000
"""

import argparse
import os
import shutil
import sys
import numpy as np
import xarray as xr
from tqdm import tqdm

# Define the exact target tensor boundaries
TARGET_LAT = np.arange(5.0, 30.0, 0.25)
TARGET_LON = np.arange(45.0, 105.0, 0.25)
TARGET_DEPTHS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]

def is_valid_netcdf(filepath: str) -> bool:
    """Checks if the target NetCDF file is fully written, uncorrupted, and matches tensor dimensions."""
    if not os.path.exists(filepath):
        return False
    try:
        with xr.open_dataset(filepath) as ds:
            # Check if dimensions match the new standardized 100x240x15 tensor
            if len(ds.latitude) == 100 and len(ds.longitude) == 240 and len(ds.depth) == 15:
                return True
        return False
    except Exception:
        return False

def process_month(year: int, month: int, input_dir: str, output_dir: str, temp_dir: str) -> bool:
    month_str = f"{month:02d}"
    input_filename = f"glorys_thetao_{year}_{month_str}.nc"
    output_filename = f"glorys_target_thetao_{year}_{month_str}.nc"
    
    input_filepath = os.path.join(input_dir, input_filename)
    output_filepath = os.path.join(output_dir, output_filename)
    temp_filepath = os.path.join(temp_dir, f"temp_{output_filename}")

    # 1. Skip if already successfully processed
    if is_valid_netcdf(output_filepath):
        tqdm.write(f"[{year}-{month_str}] Already standardized. Skipping.")
        return True

    # 2. Check if raw data actually exists before trying to process
    if not os.path.exists(input_filepath):
        tqdm.write(f"[{year}-{month_str}] [WARNING] Input file missing: {input_filename}")
        return False

    # Clean up any lingering temp file
    if os.path.exists(temp_filepath):
        os.remove(temp_filepath)

    tqdm.write(f"[{year}-{month_str}] Regridding to 100x240x15 tensor...")

    try:
        # Load, interpolate with extrapolation, and cast to float32 for ML optimization
        with xr.open_dataset(input_filepath) as ds:
            ds_standardized = ds.interp(
                latitude=TARGET_LAT,
                longitude=TARGET_LON,
                depth=TARGET_DEPTHS,
                method="linear",
                kwargs={"fill_value": "extrapolate"}
            ).astype(np.float32)

            # Save to temporary file first (Atomic Write)
            ds_standardized.to_netcdf(temp_filepath)

        # Move to final destination upon success
        if is_valid_netcdf(temp_filepath):
            shutil.move(temp_filepath, output_filepath)
            tqdm.write(f"[{year}-{month_str}] Successfully saved to {output_filepath}")
            return True
        else:
            tqdm.write(f"[{year}-{month_str}] [ERROR] Processed file failed validation.")
            if os.path.exists(temp_filepath):
                os.remove(temp_filepath)
            return False

    except Exception as e:
        tqdm.write(f"[{year}-{month_str}] [EXCEPTION] {e}")
        if os.path.exists(temp_filepath):
            os.remove(temp_filepath)
        return False

def main():
    parser = argparse.ArgumentParser(description="Standardizes GLORYS data to the target ML tensor grid.")
    parser.add_argument("--year", type=int, default=2000, help="Year to process (e.g., 2000)")
    parser.add_argument("--input-dir", type=str, default="glorys_data/Down", help="Raw data folder")
    parser.add_argument("--output-dir", type=str, default="glorys_data/Target", help="Standardized data folder")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)
    temp_dir = os.path.join(args.output_dir, ".tmp")
    os.makedirs(temp_dir, exist_ok=True)

    print("=" * 60)
    print(f"STARTING REGRIDDING PIPELINE FOR YEAR: {args.year}")
    print(f"Input: {os.path.abspath(args.input_dir)}")
    print(f"Output: {os.path.abspath(args.output_dir)}")
    print("=" * 60)

    successful_months = []
    failed_months = []

    try:
        # Loop through all 12 months
        for month in tqdm(range(1, 13), desc=f"Year {args.year} Processing", unit="month"):
            success = process_month(args.year, month, args.input_dir, args.output_dir, temp_dir)
            if success:
                successful_months.append(month)
            else:
                failed_months.append(month)

    except KeyboardInterrupt:
        # Graceful exit block triggered by Ctrl+C
        print("\n\n" + "=" * 60)
        print("🛑 PROCESSING STOPPED (Manually Interrupted)")
        print("=" * 60)
        sys.exit(0)

    finally:
        # Always clean up the temporary directory
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)

    print("\n" + "=" * 60)
    if not failed_months:
        print(f"[COMPLETED] All available months for {args.year} regridded successfully!")
    else:
        print(f"[WARNING] Some months were skipped or failed: {failed_months}")
    print("=" * 60)

if __name__ == "__main__":
    main()