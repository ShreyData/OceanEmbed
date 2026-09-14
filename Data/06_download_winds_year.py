#!/usr/bin/env python3
"""
06_download_winds_year.py: Resumable, atomic yearly downloader for ERA5 Surface Winds.
Usage:
    python 06_download_winds_year.py --year 2021
"""

import argparse
import os
import shutil
import sys
import calendar
import xarray as xr
from tqdm import tqdm
import cdsapi

d_year = 2021

# Bounding box configurations (CDS Area format: [North, West, South, East])
AREA = [30.0, 45.0, 5.0, 105.0]

def is_netcdf_valid(filepath: str) -> bool:
    """Verifies that the ERA5 NetCDF file is fully intact and contains wind variables."""
    if not os.path.exists(filepath):
        return False
    try:
        with xr.open_dataset(filepath) as ds:
            # ERA5 uses either 'u10'/'v10' or the full string names depending on the backend
            has_u = 'u10' in ds.data_vars or '10m_u_component_of_wind' in ds.data_vars
            has_v = 'v10' in ds.data_vars or '10m_v_component_of_wind' in ds.data_vars
            
            # Check for valid time dimension (valid_time or time)
            has_time = 'valid_time' in ds.dims or 'time' in ds.dims

            if has_u and has_v and has_time:
                return True
        return False
    except Exception:
        return False

def download_month(year: int, month: int, output_dir: str, temp_dir: str, c: cdsapi.Client) -> bool:
    """Downloads one month atomically via CDS API and validates before saving."""
    month_str = f"{month:02d}"
    final_filename = f"winds_{month_str}_{year}.nc"
    final_filepath = os.path.join(output_dir, final_filename)

    # 1. Skip if already downloaded and valid
    if is_netcdf_valid(final_filepath):
        tqdm.write(f"[{year}-{month_str}] Already downloaded and valid. Skipping.")
        return True

    # 2. Dynamically generate the exact days for this specific month/year (handles leap years)
    num_days = calendar.monthrange(year, month)[1]
    days_list = [f"{d:02d}" for d in range(1, num_days + 1)]

    temp_filepath = os.path.join(temp_dir, f"temp_{final_filename}")

    # Remove residual temp file from previous failed run if present
    if os.path.exists(temp_filepath):
        os.remove(temp_filepath)

    tqdm.write(f"[{year}-{month_str}] Downloading ERA5 Winds ({num_days} days)...")

    try:
        # Download into temporary directory
        c.retrieve(
            'reanalysis-era5-single-levels',
            {
                'product_type': 'reanalysis',
                'format': 'netcdf',
                'variable': [
                    '10m_u_component_of_wind',
                    '10m_v_component_of_wind',
                ],
                'year': str(year),
                'month': month_str,
                'day': days_list,
                'time': [
                    '00:00', '06:00', '12:00', '18:00',
                ],
                'area': AREA,
            },
            temp_filepath
        )

        # 3. Validate before moving to target folder
        if is_netcdf_valid(temp_filepath):
            shutil.move(temp_filepath, final_filepath)
            tqdm.write(f"[{year}-{month_str}] Successfully saved to {final_filepath}")
            return True
        else:
            tqdm.write(f"[{year}-{month_str}] [ERROR] Downloaded file corrupted, missing variables, or empty.")
            if os.path.exists(temp_filepath):
                os.remove(temp_filepath)
            return False

    except Exception as e:
        tqdm.write(f"[{year}-{month_str}] [EXCEPTION] {e}")
        if os.path.exists(temp_filepath):
            os.remove(temp_filepath)
        return False

def main():
    parser = argparse.ArgumentParser(description="Resumable yearly ERA5 Winds dataset downloader.")
    parser.add_argument("--year", type=int, default=d_year, help="Year to download (e.g., 2021)")
    parser.add_argument("--base-dir", type=str, default="winds_data/Down", help="Base output directory path")
    args = parser.parse_args()

    # Create target path: winds_data/Down/{year}/
    year_output_dir = os.path.join(args.base_dir, str(args.year))
    os.makedirs(year_output_dir, exist_ok=True)

    temp_dir = os.path.join(year_output_dir, ".tmp")
    os.makedirs(temp_dir, exist_ok=True)

    print("=" * 60)
    print(f"STARTING ERA5 WINDS DOWNLOAD PIPELINE FOR YEAR: {args.year}")
    print(f"Target Directory: {os.path.abspath(year_output_dir)}")
    print("=" * 60)

    # Initialize the CDS API client once for the whole loop
    try:
        c = cdsapi.Client()
    except Exception as e:
        print(f"[FATAL] Failed to initialize CDS API Client. Ensure ~/.cdsapirc is configured correctly.\nError: {e}")
        sys.exit(1)

    successful_months = []
    failed_months = []
    remaining_months = list(range(1, 13))

    try:
        for month in tqdm(range(1, 13), desc=f"Year {args.year} Winds Progress", unit="month"):
            success = download_month(args.year, month, year_output_dir, temp_dir, c)

            remaining_months.remove(month)
            if success:
                successful_months.append(month)
            else:
                failed_months.append(month)

    except KeyboardInterrupt:
        print("\n\n" + "=" * 60)
        print("🛑 DOWNLOAD STOPPED (Manually Interrupted)")
        print("=" * 60)
        print(f"Downloaded -> {successful_months}")
        if failed_months:
            print(f"Failed     -> {failed_months}")
        print(f"Remaining  -> {remaining_months}")
        print("=" * 60)
        sys.exit(0)

    finally:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)

    print("\n" + "=" * 60)
    if not failed_months:
        print(f"[COMPLETED] All 12 months for {args.year} successfully downloaded!")
    else:
        print(f"[INCOMPLETE] Failed months for {args.year}: {failed_months}")
        print("Run the script again to automatically resume and download missing months.")
    print("=" * 60)

if __name__ == "__main__":
    main()