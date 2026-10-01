#!/usr/bin/env python3
import xarray as xr
import os

def generate_3d_mask():
    # Use the aligned data where NaNs are still explicit to prevent accidental masking
    # of ocean pixels that normalized to exactly 0.0.
    input_path = 'data_pipeline/data/processed/model_ready/target_aligned.nc'
    output_path = 'data_pipeline/data/processed/ml_ready/ocean_mask_3d.nc'
    
    print(f"Loading 22 years of GLORYS target data from {input_path}...")
    ds = xr.open_dataset(input_path, chunks={'time': 100})
    
    # 1. Calculate the 3D Mask across the entire time axis
    # .notnull() creates a boolean matrix where True = Ocean, False = Land/NaN
    # .any(dim='time') collapses the 22-year sequence. If a pixel was valid ocean 
    # for even a single day in 22 years, it is permanently flagged as Ocean (True).
    print("Compressing time dimension and mapping 3D bathymetry...")
    mask_3d = ds['thetao'].notnull().any(dim='time').compute()
    
    # 2. Convert boolean (True/False) to integer (1/0) for clean PyTorch loss multiplication
    mask_3d = mask_3d.astype(int)
    
    # 3. Package and save to your ML-ready directory
    mask_ds = mask_3d.to_dataset(name='ocean_mask')
    mask_ds.to_netcdf(output_path)
    
    print(f"\n3D Mask successfully saved to: {output_path}")
    print(f"Final Mask Shape: {mask_ds['ocean_mask'].shape} (Depths, Lat, Lon)\n")
    
    # 4. Verification Printout
    print("--- Valid Ocean Pixels per Depth Level ---")
    depths = mask_ds.depth.values
    for i, d in enumerate(depths):
        ocean_pixels = int(mask_ds['ocean_mask'].isel(depth=i).sum().item())
        print(f"Depth {d:7.2f}m : {ocean_pixels} pixels")

if __name__ == "__main__":
    generate_3d_mask()