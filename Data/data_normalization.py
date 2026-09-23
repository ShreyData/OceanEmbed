#!/usr/bin/env python3
import os
import json
import xarray as xr

def main():
    input_dir = 'model_ready_data'
    output_dir = 'ml_ready_tensors'
    os.makedirs(output_dir, exist_ok=True)
    
    feature_files = ['sst_aligned.nc', 'sss_aligned.nc', 'ssh_aligned.nc', 'winds_aligned.nc', 'currents_aligned.nc']
    target_file = 'target_aligned.nc'
    
    stats_dict = {}
    normalized_features = []

    # 1. Process and Merge Features
    print("Processing Features...")
    for filename in feature_files:
        filepath = os.path.join(input_dir, filename)
        ds = xr.open_dataset(filepath, chunks={'time': 100})
        ds_normalized = ds.copy()
        
        for var in ds.data_vars:
            var_mean = ds[var].mean(skipna=True).compute().item()
            var_std = ds[var].std(skipna=True).compute().item()
            stats_dict[var] = {'mean': var_mean, 'std': var_std}
            
            ds_normalized[var] = (ds[var] - var_mean) / var_std
            ds_normalized[var] = ds_normalized[var].fillna(0.0)
            
        normalized_features.append(ds_normalized)
        print(f"  - Normalized {filename}")

    # Merge all 5 feature datasets into one
    ds_features_merged = xr.merge(normalized_features)
    features_out_path = os.path.join(output_dir, 'features_normalized.nc')
    ds_features_merged.to_netcdf(features_out_path)
    print(f"Saved merged features to {features_out_path}")
    
    for ds in normalized_features:
        ds.close()

    # 2. Process Target Independently
    print("\nProcessing Target...")
    ds_target = xr.open_dataset(os.path.join(input_dir, target_file), chunks={'time': 100})
    ds_target_normalized = ds_target.copy()
    
    for var in ds_target.data_vars:
        var_mean = ds_target[var].mean(skipna=True).compute().item()
        var_std = ds_target[var].std(skipna=True).compute().item()
        stats_dict[var] = {'mean': var_mean, 'std': var_std}
        
        ds_target_normalized[var] = (ds_target[var] - var_mean) / var_std
        ds_target_normalized[var] = ds_target_normalized[var].fillna(0.0)
        
    target_out_path = os.path.join(output_dir, 'target_normalized.nc')
    ds_target_normalized.to_netcdf(target_out_path)
    ds_target.close()
    print(f"Saved normalized target to {target_out_path}")
        
    # 3. Export Stats
    stats_path = os.path.join(output_dir, 'normalization_stats.json')
    with open(stats_path, 'w') as f:
        json.dump(stats_dict, f, indent=4)
    print(f"\nNormalization statistics saved to {stats_path}")

if __name__ == "__main__":
    main()