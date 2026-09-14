"""Incrementally bulk-import stored temperature output from the existing NetCDF file."""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import numpy as np
import psycopg
import xarray as xr
from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = BACKEND_ROOT.parent
DEFAULT_INPUT = REPOSITORY_ROOT / "Data" / "glorys_data" / "glorys_target_thetao_2020_01.nc"
STANDARD_DEPTHS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]


def get_database_url() -> str:
    load_dotenv(BACKEND_ROOT / ".env")
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set. Copy .env.example to .env and configure it.")
    return url


def inspect_dataset(source: Path) -> xr.Dataset:
    dataset = xr.open_dataset(source)
    required = {"time", "depth", "latitude", "longitude", "thetao"}
    missing = required - (set(dataset.coords) | set(dataset.data_vars))
    if missing:
        dataset.close()
        raise ValueError(f"Dataset is missing required coordinates/variable: {sorted(missing)}")
    if dataset["thetao"].dims != ("time", "depth", "latitude", "longitude"):
        dataset.close()
        raise ValueError(f"Unexpected thetao dimensions: {dataset['thetao'].dims}")
    depths = [int(value) for value in dataset["depth"].values]
    if depths != STANDARD_DEPTHS:
        dataset.close()
        raise ValueError(f"Unexpected depth levels: {depths}; expected {STANDARD_DEPTHS}")
    return dataset


def verify_database(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT COUNT(*), MIN(date), MAX(date), MIN(latitude), MAX(latitude),
                   MIN(longitude), MAX(longitude), ARRAY_AGG(DISTINCT depth_m ORDER BY depth_m)
            FROM ocean_temperature_output
        """)
        row = cur.fetchone()
    print("Database verification:")
    print(f"  Total rows: {row[0]}")
    print(f"  Dates: {row[1]} to {row[2]}")
    print(f"  Latitude: {row[3]} to {row[4]}")
    print(f"  Longitude: {row[5]} to {row[6]}")
    print(f"  Depth levels ({len(row[7] or [])}): {row[7] or []}")


def import_file(source: Path) -> None:
    if not source.is_file():
        raise FileNotFoundError(f"Input file does not exist: {source}")
    started = time.perf_counter()
    print("Opening dataset...")
    dataset = inspect_dataset(source)
    data = dataset["thetao"]
    times = dataset["time"].values
    depths = dataset["depth"].values
    latitudes = dataset["latitude"].values
    longitudes = dataset["longitude"].values
    print("Detected:")
    print(f"{len(times)} dates\n{len(depths)} depths\n{len(latitudes)} latitude values\n{len(longitudes)} longitude values")
    valid_total = skipped_total = inserted_total = conflict_total = 0
    try:
        with psycopg.connect(get_database_url()) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TEMP TABLE ocean_temperature_stage (
                        date DATE NOT NULL, latitude DOUBLE PRECISION NOT NULL,
                        longitude DOUBLE PRECISION NOT NULL, depth_m INTEGER NOT NULL,
                        temperature_c DOUBLE PRECISION NOT NULL
                    ) ON COMMIT PRESERVE ROWS
                """)
                for time_index, raw_date in enumerate(times):
                    date = np.datetime_as_string(raw_date, unit="D")
                    print(f"Processing {date} [{time_index + 1}/{len(times)}]")
                    cur.execute("TRUNCATE ocean_temperature_stage")
                    values = data.isel(time=time_index).values
                    finite_mask = np.isfinite(values)
                    valid_count = int(finite_mask.sum())
                    skipped_count = int(values.size - valid_count)
                    valid_total += valid_count
                    skipped_total += skipped_count
                    with cur.copy("COPY ocean_temperature_stage (date, latitude, longitude, depth_m, temperature_c) FROM STDIN") as copy:
                        for depth_index, depth in enumerate(depths):
                            positions = np.argwhere(finite_mask[depth_index])
                            for lat_index, lon_index in positions:
                                copy.write_row((date, float(latitudes[lat_index]), float(longitudes[lon_index]), int(depth), float(values[depth_index, lat_index, lon_index])))
                    cur.execute("""
                        INSERT INTO ocean_temperature_output (date, latitude, longitude, depth_m, temperature_c)
                        SELECT date, latitude, longitude, depth_m, temperature_c
                        FROM ocean_temperature_stage
                        ON CONFLICT (date, latitude, longitude, depth_m) DO NOTHING
                    """)
                    inserted = cur.rowcount
                    inserted_total += inserted
                    conflict_total += valid_count - inserted
                    conn.commit()
                    print(f"Valid values: {valid_count}; inserted: {inserted}; already present: {valid_count - inserted}")
            verify_database(conn)
    finally:
        dataset.close()
    elapsed = time.perf_counter() - started
    print("Import complete:")
    print(f"  Elapsed time: {elapsed:.2f}s")
    print(f"  Valid source values: {valid_total}")
    print(f"  Skipped invalid/NaN values: {skipped_total}")
    print(f"  New rows inserted: {inserted_total}")
    print(f"  Rows skipped because already present: {conflict_total}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT, help="NetCDF input file")
    args = parser.parse_args()
    try:
        import_file(args.input)
    except (OSError, ValueError, psycopg.Error, RuntimeError) as exc:
        print(f"Import failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
