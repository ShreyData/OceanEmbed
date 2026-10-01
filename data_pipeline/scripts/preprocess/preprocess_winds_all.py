#!/usr/bin/env python3
"""
12_preprocess_winds_all.py: Bulk interpolates raw S3 Winds data to the exact 100x240 2D master grid.
Usage:
    python 12_preprocess_winds_all.py
"""

import os
import glob
import shutil
import sys
import numpy as np
import xarray as xr
from tqdm import tqdm

# Define the exact 2D target tensor boundaries (100x240 grid at 0.25 deg resolution)
TARGET_LAT = np.arange(5.0, 30.0, 0.25)
TARGET_LON = np.arange(45.0, 105.0, 0.25)

def is_valid_netcdf(filepath: str) -> bool:
    """Checks if the standardized Winds NetCDF contains uwnd, vwnd and matches 100x240 dimensions."""
    if not os.path.exists(filepath):
        return False
    try:
        with xr.open_dataset(filepath) as ds:
            if len(ds.latitude) == 100 and len(ds.longitude) == 240:
                if all(v in ds.data_vars for v in ["uwnd", "vwnd"]):
                    return True
        return False
    except Exception:
        return False

def main():
    input_base_dir = os.path.join("data_pipeline/data/raw/winds", "Down")
    output_dir = os.path.join("data_pipeline/data/raw/winds", "Winds")
    
    os.makedirs(output_dir, exist_ok=True)
    temp_dir = os.path.join(output_dir, ".tmp")
    os.makedirs(temp_dir, exist_ok=True)

    print("=" * 60)
    print("STARTING BULK REGRIDDING PIPELINE FOR WINDS DATA")
    print(f"Scanning for inputs in: {os.path.abspath(input_base_dir)}")
    print(f"Target Directory: {os.path.abspath(output_dir)}")
    print("=" * 60)

    search_pattern = os.path.join(input_base_dir, "**", "winds_*.nc")
    all_raw_files = glob.glob(search_pattern, recursive=True)
    all_raw_files.sort()

    if not all_raw_files:
        print("[ERROR] No raw Winds files found. Please check your download directories.")
        sys.exit(1)

    print(f"Found {len(all_raw_files)} files to process.\n")

    successful_files = 0
    failed_files = []

    try:
        for input_filepath in tqdm(all_raw_files, desc="Processing Winds", unit="file"):
            filename = os.path.basename(input_filepath)
            
            parts = filename.split('_')
            if len(parts) >= 3:
                month = parts[1]
                year = parts[2].split('.')[0]
                output_filename = f"winds_input_{month}_{year}.nc"
            else:
                failed_files.append(filename)
                continue

            output_filepath = os.path.join(output_dir, output_filename)
            temp_filepath = os.path.join(temp_dir, f"temp_{output_filename}")

            if is_valid_netcdf(output_filepath):
                successful_files += 1
                continue

            if os.path.exists(temp_filepath):
                os.remove(temp_filepath)

            try:
                with xr.open_dataset(input_filepath) as ds:
                    
                    # Interpolate uwnd, vwnd to exact master coordinate grid
                    ds_standardized = ds.interp(
                        latitude=TARGET_LAT,
                        longitude=TARGET_LON,
                        method="linear",
                        kwargs={"fill_value": "extrapolate"}
                    ).astype(np.float32)

                    # Note: Intentional omission of .fillna(0.0) based on pipeline requirements
                    ds_standardized.to_netcdf(temp_filepath)

                if is_valid_netcdf(temp_filepath):
                    shutil.move(temp_filepath, output_filepath)
                    successful_files += 1
                else:
                    failed_files.append(filename)
                    if os.path.exists(temp_filepath):
                        os.remove(temp_filepath)

            except Exception as e:
                print(f"\n[FATAL ERROR] on {filename}: {str(e)}")
                if os.path.exists(temp_filepath):
                    os.remove(temp_filepath)
                sys.exit(1)

    except KeyboardInterrupt:
        print("\n\n" + "=" * 60)
        print("🛑 PROCESSING STOPPED (Manually Interrupted)")
        print("=" * 60)
        sys.exit(0)

    finally:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)

    print("\n" + "=" * 60)
    if not failed_files:
        print(f"[COMPLETED] Successfully regridded all {successful_files} files!")
    else:
        print(f"[WARNING] Processed {successful_files} files, but {len(failed_files)} failed:")
        print(failed_files[:10])
    print("=" * 60)

if __name__ == "__main__":
    main()