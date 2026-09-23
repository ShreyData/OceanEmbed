#!/usr/bin/env python3
import os
import xarray as xr

def fill_coastal_gaps(ds, limit=5):
    """Fills coastal NaNs by extrapolating nearest valid ocean pixels."""
    ds_filled = ds.copy()
    for var in ds_filled.data_vars:
        da = ds_filled[var]
        
        # 1. Lock the chunks, then extrapolate longitude
        da = da.chunk({'latitude': -1, 'longitude': -1})
        da = da.interpolate_na(dim='longitude', method='nearest', limit=limit)
        
        # 2. Lock the chunks AGAIN because the previous step fragments the Dask graph, then extrapolate latitude
        da = da.chunk({'latitude': -1, 'longitude': -1})
        da = da.interpolate_na(dim='latitude', method='nearest', limit=limit)
        
        ds_filled[var] = da
    return ds_filled

def main():
    input_files = {
        'target': 'glorys_data/glorys_target_master_merged.nc',
        'sst': 'sst_data/sst_master_merged.nc',
        'sss': 'sss_data/sss_master_merged.nc',
        'ssh': 'ssh_data/ssh_master_merged.nc',
        'winds': 'winds_data/winds_master_merged.nc',
        'currents': 'currents_data/currents_master_merged.nc'
    }
    
    output_dir = 'model_ready_data'
    os.makedirs(output_dir, exist_ok=True)
    mask_path = os.path.join(output_dir, 'official_landmask.nc')
    
    print("Loading official master mask...")
    official_mask = xr.open_dataarray(mask_path)
    
    for name, path in input_files.items():
        print(f"Processing {name}...")
        
        ds = xr.open_dataset(path, chunks={'time': 100})
        
        if name in ['target', 'winds']:
            ds_aligned = ds.where(official_mask)
        else:
            ds_filled = fill_coastal_gaps(ds, limit=5)
            ds_aligned = ds_filled.where(official_mask)
        
        out_path = os.path.join(output_dir, f"{name}_aligned.nc")
        
        # Ensure the final write keeps the chunks stable
        ds_aligned = ds_aligned.chunk({'latitude': -1, 'longitude': -1})
        ds_aligned.to_netcdf(out_path)
        
        ds.close()
        print(f"Saved {out_path}")
        
    print("All datasets successfully aligned to the master mask.")

if __name__ == "__main__":
    main()