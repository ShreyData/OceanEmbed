#!/usr/bin/env python3
"""
17_merge_ssh_all.py: Merges all monthly SSH (Sea Surface Height) files into a single master tensor.
Downcasts all spatial coordinates (latitude, longitude) to 32-bit precision.
"""

import os
import glob
import sys
import numpy as np
import xarray as xr

def main():
    input_base_dir = os.path.join("data_pipeline/data/raw/ssh", "SSH")
    output_filepath = os.path.join("data_pipeline/data/raw/ssh", "ssh_master_merged.nc")

    print("=" * 60)
    print("STARTING BULK MERGE FOR SSH DATA")
    print(f"Scanning for inputs in: {os.path.abspath(input_base_dir)}")
    print("=" * 60)

    search_pattern = os.path.join(input_base_dir, "**", "*.nc")
    all_files = glob.glob(search_pattern, recursive=True)
    all_files.sort()

    if not all_files:
        print("[ERROR] No SSH files found. Check your directory path.")
        sys.exit(1)

    print(f"Found {len(all_files)} monthly files. Lazily building the master tensor...")

    # 1. Lazy Load & Concatenate
    ds = xr.open_mfdataset(
        all_files, 
        combine='by_coords',
        chunks={'time': 100} 
    )

    print("Downcasting 64-bit coordinates to 32-bit precision...")
    
    # 2. Downcast Spatial Coordinates (float64 -> float32)
    if ds.latitude.dtype == 'float64':
        ds['latitude'] = ds.latitude.astype(np.float32)
    if ds.longitude.dtype == 'float64':
        ds['longitude'] = ds.longitude.astype(np.float32)

    print("\nFinal Master Dataset Structure:")
    print(ds.dims)
    print(ds.dtypes)

    print(f"\nWriting massive tensor to disk: {output_filepath}")
    print("This may take several minutes depending on your disk I/O speed...")
    
    # 3. Stream to disk
    ds.to_netcdf(output_filepath)
    
    print("\n✅ SSH Master Merge Complete!")

if __name__ == "__main__":
    main()