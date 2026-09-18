#!/usr/bin/env python3
"""
11_preprocess_winds_all.py: Bulk interpolates raw ERA5 Winds data to the 100x240 2D tensor format.
Usage:
    python 11_preprocess_winds_all.py
"""

import os
import glob
import shutil
import sys
import numpy as np
import xarray as xr
from tqdm import tqdm

# Define the exact 2D target tensor boundaries
TARGET_LAT = np.arange(5.0, 30.0, 0.25)
TARGET_LON = np.arange(45.0, 105.0, 0.25)

def is_valid_netcdf(filepath: str) -> bool:
    """Checks if the standardized Winds NetCDF file contains u10/v10 and matches tensor dimensions."""
    if not os.path.exists(filepath):
        return False
    try:
        with xr.open_dataset(filepath) as ds:
            # Check if dimensions match the standardized 100x240 tensor
            if len(ds.latitude) == 100 and len(ds.longitude) == 240:
                # Ensure both wind vectors are present
                if "u10" in ds.data_vars and "v10" in ds.data_vars:
                    return True
        return False
    except Exception:
        return False

def main():
    input_base_dir = os.path.join("winds_data", "Down")
    output_dir = os.path.join("winds_data", "Winds")
    
    os.makedirs(output_dir, exist_ok=True)
    temp_dir = os.path.join(output_dir, ".tmp")
    os.makedirs(temp_dir, exist_ok=True)

    print("=" * 60)
    print("STARTING BULK REGRIDDING PIPELINE FOR ERA5 WINDS DATA")
    print(f"Scanning for inputs in: {os.path.abspath(input_base_dir)}")
    print(f"Target Directory: {os.path.abspath(output_dir)}")
    print("=" * 60)

    # Recursively find all downloaded Winds netCDF files across all year subfolders
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
        for input_filepath in tqdm(all_raw_files, desc="Processing Winds Files", unit="file"):
            filename = os.path.basename(input_filepath)
            
            # Reformat output name: winds_01_2000.nc -> winds_input_01_2000.nc
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

            # 1. Skip if already successfully processed
            if is_valid_netcdf(output_filepath):
                successful_files += 1
                continue

            # Clean up any lingering temp file
            if os.path.exists(temp_filepath):
                os.remove(temp_filepath)

            try:
                with xr.open_dataset(input_filepath) as ds:
                    
                    # 2. Standardize time coordinate name
                    if "valid_time" in ds.dims or "valid_time" in ds.coords:
                        ds = ds.rename({"valid_time": "time"})
                    
                    # 3. Drop ERA5 junk metadata scalar coordinates to keep tensors clean
                    vars_to_drop = [v for v in ["number", "expver"] if v in ds.coords or v in ds.variables]
                    if vars_to_drop:
                        ds = ds.drop_vars(vars_to_drop)

                    # 4. Interpolate to 100x240 grid with edge extrapolation (flips latitude automatically)
                    ds_standardized = ds.interp(
                        latitude=TARGET_LAT,
                        longitude=TARGET_LON,
                        method="linear",
                        kwargs={"fill_value": "extrapolate"}
                    ).astype(np.float32)

                    # Save to temporary file (Atomic Write)
                    ds_standardized.to_netcdf(temp_filepath)

                # Move to final destination upon success
                if is_valid_netcdf(temp_filepath):
                    shutil.move(temp_filepath, output_filepath)
                    successful_files += 1
                else:
                    failed_files.append(filename)
                    if os.path.exists(temp_filepath):
                        os.remove(temp_filepath)

            except Exception as e:
                # UNMASKED ERROR BLOCK: Prints exact failure reason and stops execution
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
        # Always clean up the temporary directory
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