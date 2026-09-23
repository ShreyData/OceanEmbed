#!/usr/bin/env python3
import os
import xarray as xr

def main():
    # UPDATE THIS PATH TO YOUR EXACT GLORYS TARGET FILE
    target_path = 'glorys_data/glorys_target_master_merged.nc'
    
    output_dir = 'model_ready_data'
    os.makedirs(output_dir, exist_ok=True)
    mask_path = os.path.join(output_dir, 'official_landmask.nc')
    
    print("Loading GLORYS target data...")
    ds_target = xr.open_dataset(target_path, chunks={'time': 100})
    
    print("Computing the immutable master mask...")
    # True if the pixel is valid across EVERY time step, False otherwise
    official_mask = ds_target['thetao'].isel(depth=0).notnull().all(dim='time').compute()
    official_mask.name = 'official_glorys_mask'
    
    total_pixels = official_mask.size
    valid_ocean = int(official_mask.sum().item())
    permanent_land = total_pixels - valid_ocean
    
    print("=" * 50)
    print("MASK EXTRACTION COMPLETE")
    print(f"Total Grid Pixels:     {total_pixels}")
    print(f"Valid Ocean Pixels:    {valid_ocean}")
    print(f"Permanent Land Pixels: {permanent_land}")
    print("=" * 50)
    
    official_mask.to_netcdf(mask_path)
    print(f"Saved independent master mask to: {mask_path}")
    
    ds_target.close()

if __name__ == "__main__":
    main()