#!/usr/bin/env python3
"""
19_merge_currents_all.py: Merges all monthly Currents files into a single master tensor.
Resolves Julian calendar 'object' timestamps to standard datetime64[ns] and downcasts coordinates.
"""

import os
import glob
import sys
import numpy as np
import pandas as pd
import xarray as xr

def main():
    input_base_dir = os.path.join("data_pipeline/data/raw/currents", "Currents")
    output_filepath = os.path.join("data_pipeline/data/raw/currents", "currents_master_merged.nc")

    print("=" * 60)
    print("STARTING BULK MERGE FOR CURRENTS DATA")
    print(f"Scanning for inputs in: {os.path.abspath(input_base_dir)}")
    print("=" * 60)

    search_pattern = os.path.join(input_base_dir, "**", "*.nc")
    all_files = glob.glob(search_pattern, recursive=True)
    all_files.sort()

    if not all_files:
        print("[ERROR] No Currents files found. Check your directory path.")
        sys.exit(1)

    print(f"Found {len(all_files)} monthly files. Lazily building the master tensor...")

    # 1. Lazy Load & Concatenate
    ds = xr.open_mfdataset(
        all_files, 
        combine='by_coords',
        chunks={'time': 100} 
    )

    # 2. Fix Julian Calendar 'object' time arrays
    print("Standardizing Julian 'object' timestamps to datetime64[ns]...")
    if ds.time.dtype == 'O':
        # Convert cftime objects to strings, then let Pandas parse them to standard datetime64[ns]
        ds['time'] = pd.to_datetime(ds.time.values.astype(str))

    print("Downcasting 64-bit coordinates to 32-bit precision...")
    
    # 3. Downcast Spatial Coordinates (float64 -> float32)
    if ds.latitude.dtype == 'float64':
        ds['latitude'] = ds.latitude.astype(np.float32)
    if ds.longitude.dtype == 'float64':
        ds['longitude'] = ds.longitude.astype(np.float32)

    print("\nMaster Dataset Structure:")
    print(ds.dims)
    print(ds.dtypes)

    print(f"\nWriting massive tensor to disk: {output_filepath}")
    print("This may take several minutes depending on your disk I/O speed...")
    
    # 4. Stream to disk
    ds.to_netcdf(output_filepath)
    
    print("\n✅ Currents Master Merge Complete!")

if __name__ == "__main__":
    main()