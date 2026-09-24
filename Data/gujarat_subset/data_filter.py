import os
import shutil
import xarray as xr

def create_gujarat_subset():
    input_dir = '/mnt/Data/SIH 2k26/Data/ml_ready_tensors'
    output_dir = '.'
    os.makedirs(output_dir, exist_ok=True)
    
    time_bounds = slice('2020-01-01', '2022-12-31')
    
    print("Loading datasets...")
    ds_feats = xr.open_dataset(f"{input_dir}/features_normalized.nc")
    ds_target = xr.open_dataset(f"{input_dir}/target_normalized.nc")
    ds_mask = xr.open_dataset(f"{input_dir}/ocean_mask_3d.nc")
    
    # Check latitude orientation to ensure slice works correctly (ascending vs descending)
    lat_start, lat_end = (18.0, 24.0)
    if ds_feats.latitude.values[0] > ds_feats.latitude.values[-1]:
        lat_bounds = slice(lat_end, lat_start)
    else:
        lat_bounds = slice(lat_start, lat_end)
        
    lon_bounds = slice(67.0, 73.0)

    print("Subsetting features...")
    ds_feats_sub = ds_feats.sel(latitude=lat_bounds, longitude=lon_bounds, time=time_bounds)
    ds_feats_sub.to_netcdf(f"{output_dir}/features_normalized.nc")
    
    print("Subsetting target...")
    ds_target_sub = ds_target.sel(latitude=lat_bounds, longitude=lon_bounds, time=time_bounds)
    ds_target_sub.to_netcdf(f"{output_dir}/target_normalized.nc")
    
    print("Subsetting 3D mask...")
    ds_mask_sub = ds_mask.sel(latitude=lat_bounds, longitude=lon_bounds)
    ds_mask_sub.to_netcdf(f"{output_dir}/ocean_mask_3d.nc")
    
    print("Copying normalization stats...")
    shutil.copy(f"{input_dir}/normalization_stats.json", f"{output_dir}/normalization_stats.json")
    
    print(f"\nSubset complete.")
    print(f"Spatial Grid: {ds_feats_sub.latitude.size}x{ds_feats_sub.longitude.size}")
    print(f"Time Steps: {ds_feats_sub.time.size}")
    
    ds_feats.close()
    ds_target.close()
    ds_mask.close()

if __name__ == "__main__":
    create_gujarat_subset()