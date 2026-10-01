#!/usr/bin/env python3
"""
08_preprocess_sst_all.py: Bulk interpolates raw Kelvin SST data to the 100x240 Celsius tensor format.
Usage:
    python 08_preprocess_sst_all.py
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
    """Checks if the standardized SST NetCDF file is uncorrupted and matches tensor dimensions."""
    if not os.path.exists(filepath):
        return False
    try:
        with xr.open_dataset(filepath) as ds:
            # Check if dimensions match the new standardized 100x240 2D tensor
            if len(ds.latitude) == 100 and len(ds.longitude) == 240 and "analysed_sst" in ds.data_vars:
                return True
        return False
    except Exception:
        return False

def main():
    input_base_dir = os.path.join("data_pipeline/data/raw/sst", "Down")
    output_dir = os.path.join("data_pipeline/data/raw/sst", "SST")
    
    os.makedirs(output_dir, exist_ok=True)
    temp_dir = os.path.join(output_dir, ".tmp")
    os.makedirs(temp_dir, exist_ok=True)

    print("=" * 60)
    print("STARTING BULK REGRIDDING PIPELINE FOR ALL SST DATA")
    print(f"Scanning for inputs in: {os.path.abspath(input_base_dir)}")
    print(f"Target Directory: {os.path.abspath(output_dir)}")
    print("=" * 60)

    # Recursively find all downloaded SST netCDF files across all year subfolders
    search_pattern = os.path.join(input_base_dir, "**", "sst_*.nc")
    all_raw_files = glob.glob(search_pattern, recursive=True)
    all_raw_files.sort() # Ensure chronological processing

    if not all_raw_files:
        print("[ERROR] No raw SST files found. Please check your download directories.")
        sys.exit(1)

    print(f"Found {len(all_raw_files)} files to process.\n")

    successful_files = 0
    failed_files = []

    try:
        # Process all files with a single progress bar
        for input_filepath in tqdm(all_raw_files, desc="Processing SST Files", unit="file"):
            filename = os.path.basename(input_filepath) # e.g., sst_01_2000.nc
            
            # Reformat output name: sst_01_2000.nc -> sst_input_01_2000.nc
            parts = filename.split('_')
            if len(parts) >= 3:
                month = parts[1]
                year = parts[2].split('.')[0]
                output_filename = f"sst_input_{month}_{year}.nc"
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
                    # 2. Convert from Kelvin to Celsius
                    if "analysed_sst" in ds.data_vars:
                        ds["analysed_sst"] = ds["analysed_sst"] - 273.15

                    # 3. Interpolate to 100x240 grid with extrapolation for the edges
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

            except Exception:
                failed_files.append(filename)
                if os.path.exists(temp_filepath):
                    os.remove(temp_filepath)

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
        print(failed_files[:10]) # Print first 10 failures to keep logs clean
    print("=" * 60)

if __name__ == "__main__":
    main()