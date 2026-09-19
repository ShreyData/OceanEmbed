#!/usr/bin/env python3
"""
07_download_currents_year.py: Parallel, atomic single-year downloader for OSCAR Currents.
Usage:
    python 07_download_currents_year.py --year 2000
"""

import argparse
import os
import shutil
import sys
import pandas as pd
import xarray as xr
from tqdm import tqdm
import earthaccess
import concurrent.futures
import time
import random

BBOX = {"min_lon": 45.0, "max_lon": 105.0, "min_lat": 5.0, "max_lat": 30.0}
CONCEPT_ID = "C2098858642-POCLOUD"

def is_netcdf_valid(filepath: str) -> bool:
    if not os.path.exists(filepath):
        return False
    try:
        with xr.open_dataset(filepath) as ds:
            if all(v in ds.data_vars for v in ["u", "v"]) and len(ds.time) > 0:
                return True
        return False
    except Exception:
        return False

def process_month(year: int, month: int, output_dir: str, base_temp_dir: str):
    month_str = f"{month:02d}"
    
    # 1. Jitter: Stagger worker start times by 1 to 5 seconds to prevent login stampedes
    time.sleep(random.uniform(1, 5))
    
    # 2. Retry Logic: Tolerate dropped authentication connections
    for attempt in range(3):
        try:
            earthaccess.login(persist=True)
            break  # Success, exit the loop
        except Exception as e:
            if attempt == 2:
                return f"[{year}-{month_str}] ❌ [LOGIN FAILURE] {e}"
            time.sleep(2) # Wait 2 seconds before retrying

    final_filename = f"currents_{month_str}_{year}.nc"
    final_filepath = os.path.join(output_dir, final_filename)

    if is_netcdf_valid(final_filepath):
        return f"[{year}-{month_str}] Already valid. Skipped."

    start_date = pd.Timestamp(year, month, 1, 0, 0, 0)
    end_date = start_date + pd.offsets.MonthEnd(1) + pd.Timedelta(hours=23, minutes=59, seconds=59)

    month_raw_dir = os.path.join(base_temp_dir, f"raw_{year}_{month_str}")
    os.makedirs(month_raw_dir, exist_ok=True)
    temp_filepath = os.path.join(base_temp_dir, f"temp_{final_filename}")

    try:
        print(f"[{year}-{month_str}] 🔍 Searching NASA servers...", flush=True)
        results = earthaccess.search_data(
            concept_id=CONCEPT_ID,
            temporal=(start_date.strftime("%Y-%m-%d %H:%M:%S"), end_date.strftime("%Y-%m-%d %H:%M:%S"))
        )
        
        if not results:
            return f"[{year}-{month_str}] [WARNING] No granules found."

        print(f"[{year}-{month_str}] ⬇️ Downloading {len(results)} granules...", flush=True)
        # THE FIX: Restrict earthaccess internal threading
        earthaccess.download(results, local_path=month_raw_dir, threads=2)

        print(f"[{year}-{month_str}] ⚙️ Fixing dimensions and cropping tensor...", flush=True)
        with xr.open_mfdataset(f"{month_raw_dir}/*.nc", combine='by_coords') as ds:
            if "lat" in ds.variables and "lon" in ds.variables:
                ds = ds.rename_vars({"lat": "latitude", "lon": "longitude"})

            ds_subset = ds.sel(
                latitude=slice(BBOX["min_lat"], BBOX["max_lat"]),
                longitude=slice(BBOX["min_lon"], BBOX["max_lon"])
            )
            ds_subset = ds_subset[["u", "v"]]
            
            ds_subset = ds_subset.transpose("time", "latitude", "longitude")
            ds_subset = ds_subset.squeeze(drop=True)
            
            ds_subset.to_netcdf(temp_filepath)

        if is_netcdf_valid(temp_filepath):
            shutil.move(temp_filepath, final_filepath)
            return f"[{year}-{month_str}] ✅ Successfully processed and saved."
        else:
            return f"[{year}-{month_str}] ❌ [ERROR] Output corrupted."

    except KeyboardInterrupt:
        return f"[{year}-{month_str}] 🛑 [INTERRUPTED] Worker aborted cleanly."
    except Exception as e:
        return f"[{year}-{month_str}] ❌ [EXCEPTION] {e}"
    finally:
        shutil.rmtree(month_raw_dir, ignore_errors=True)
        if os.path.exists(temp_filepath):
            os.remove(temp_filepath)
            
def main():
    parser = argparse.ArgumentParser(description="Parallel yearly OSCAR Currents downloader.")
    parser.add_argument("--year", type=int, required=True, help="Year to download")
    parser.add_argument("--base-dir", type=str, default="currents_data/Down", help="Base directory")
    args = parser.parse_args()

    year_output_dir = os.path.join(args.base_dir, str(args.year))
    os.makedirs(year_output_dir, exist_ok=True)
    
    temp_dir = os.path.join(year_output_dir, ".tmp")
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir, ignore_errors=True)
    os.makedirs(temp_dir, exist_ok=True)

    print(f"🚀 STARTING PARALLEL CURRENTS PIPELINE FOR YEAR: {args.year}")
    
    # THE FIX: Hardcap multi-processing to exactly 2 concurrent months
    max_workers = 2
    
    executor = concurrent.futures.ProcessPoolExecutor(max_workers=max_workers)
    futures = {executor.submit(process_month, args.year, m, year_output_dir, temp_dir): m for m in range(1, 13)}
    
    try:
        for future in tqdm(concurrent.futures.as_completed(futures), total=12, desc="Months Processed"):
            print(future.result(), flush=True)
            
    except KeyboardInterrupt:
        print("\n\n🛑 KEYBOARD INTERRUPT DETECTED: Shutting down workers gracefully...", flush=True)
        executor.shutdown(wait=False, cancel_futures=True)
        print("💾 Progress saved. Temporary files cleaned up.", flush=True)
        sys.exit(0)
        
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

    print(f"🏁 Year {args.year} complete.")

if __name__ == "__main__":
    main()