#!/usr/bin/env python3
"""Merge already-preprocessed 2022-2024 features into one ML-ready file.

Run from the repository root:

    python prepare_validation_from_preprocessed.py

The script reads only the standardized monthly files in Data/*_data/* folders.
It does not modify the existing preprocessing scripts, training tensors, or
training normalization statistics.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd
import xarray as xr


ROOT = Path(__file__).resolve().parent
GRID_LAT = np.arange(5.0, 30.0, 0.25, dtype=np.float32)
GRID_LON = np.arange(45.0, 105.0, 0.25, dtype=np.float32)
KINDS = {
    "sst": ("SST", ("analysed_sst",), False),
    "sss": ("SSS", ("sos",), True),
    "ssh": ("SSH", ("sla",), True),
    "winds": ("Winds", ("uwnd", "vwnd"), False),
    "currents": ("Currents", ("u", "v"), True),
}
YEARS = (2022, 2023, 2024)
LAST_DATE = pd.Timestamp("2024-12-15")


def args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--root", type=Path, default=ROOT)
    p.add_argument(
        "--output",
        type=Path,
        default=Path("Model/Evalu/Data/features_normalized.nc"),
        help="Output path, relative to --root unless absolute.",
    )
    return p.parse_args()


def path_from(root: Path, path: Path) -> Path:
    return path if path.is_absolute() else root / path


def monthly_files(root: Path, kind: str, folder: str) -> list[tuple[int, int, Path]]:
    directory = root / "Data" / f"{kind}_data" / folder
    regex = re.compile(rf"^{kind}_input_(\d{{2}})_(20(?:22|23|24))\.nc$")
    found: dict[tuple[int, int], Path] = {}
    for file in directory.glob("*.nc"):
        match = regex.match(file.name)
        if match:
            found[(int(match.group(2)), int(match.group(1)))] = file
    missing = [(year, month) for year in YEARS for month in range(1, 13) if (year, month) not in found]
    if missing:
        text = ", ".join(f"{year}-{month:02d}" for year, month in missing)
        raise FileNotFoundError(f"{kind}: missing preprocessed month(s): {text}")
    return [(year, month, found[(year, month)]) for year in YEARS for month in range(1, 13)]


def canonical_month(ds: xr.Dataset, year: int, month: int, file: Path) -> xr.Dataset:
    days = pd.Period(f"{year}-{month:02d}").days_in_month
    records = ds.sizes.get("time")
    allowed_partial_final_month = year == 2024 and month == 12 and records == 15
    if records != days and not allowed_partial_final_month:
        raise ValueError(f"{file}: expected {days} daily records, found {ds.sizes.get('time')}")
    return ds.assign_coords(time=pd.date_range(f"{year}-{month:02d}-01", periods=records, freq="D"))


def fill_coastal_gaps(ds: xr.Dataset) -> xr.Dataset:
    result = ds.copy()
    for variable in result.data_vars:
        result[variable] = result[variable].interpolate_na(
            dim="longitude", method="nearest", limit=5
        ).interpolate_na(dim="latitude", method="nearest", limit=5)
    return result


def load_feature(root: Path, kind: str) -> xr.Dataset:
    folder, variables, coastal_fill = KINDS[kind]
    pieces = []
    for year, month, file in monthly_files(root, kind, folder):
        with xr.open_dataset(file, decode_times=True) as source:
            missing = [name for name in variables if name not in source.data_vars]
            if missing:
                raise KeyError(f"{file}: missing variable(s): {', '.join(missing)}")
            piece = source[list(variables)].load()
        pieces.append(canonical_month(piece, year, month, file))
    result = xr.concat(pieces, dim="time").sortby("time")
    if coastal_fill:
        result = fill_coastal_gaps(result)
    return result


def load_mask(root: Path) -> xr.DataArray:
    file = root / "Data/model_ready_data/official_landmask.nc"
    with xr.open_dataset(file, decode_times=False) as source:
        mask = source["official_glorys_mask"].load().squeeze(drop=True)
    return mask.sel(latitude=GRID_LAT, longitude=GRID_LON, method="nearest").astype(bool)


def load_stats(root: Path) -> dict[str, dict[str, float]]:
    file = root / "Data/ml_ready_tensors/normalization_stats.json"
    with file.open() as handle:
        stats = json.load(handle)
    needed = {name for _, variables, _ in KINDS.values() for name in variables}
    missing = sorted(needed - stats.keys())
    if missing:
        raise KeyError(f"Missing training normalization statistics: {', '.join(missing)}")
    return stats


def normalize(ds: xr.Dataset, stats: dict[str, dict[str, float]]) -> xr.Dataset:
    result = ds.copy()
    for name in result.data_vars:
        result[name] = ((result[name] - stats[name]["mean"]) / stats[name]["std"]).fillna(0.0).astype(np.float32)
    return result


def main() -> None:
    options = args()
    root = options.root.resolve()
    output = path_from(root, options.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    mask = load_mask(root)
    stats = load_stats(root)
    features = []
    for kind in KINDS:
        print(f"Loading and merging preprocessed {kind}...")
        # Apply the common endpoint before merging. Some products contain
        # extra days after 2024-12-15 while others stop exactly at the cutoff.
        features.append(load_feature(root, kind).sel(time=slice("2022-01-01", LAST_DATE)))

    merged = xr.merge(features, join="exact", compat="equals")
    merged = merged.where(mask)
    merged = normalize(merged, stats)
    expected_days = 365 + 365 + 350
    if merged.sizes.get("time") != expected_days:
        raise ValueError(f"Expected {expected_days} records through {LAST_DATE.date()}, found {merged.sizes.get('time')}")

    with tempfile.TemporaryDirectory(prefix="validation_", dir=output.parent) as temporary:
        temp_output = Path(temporary) / output.name
        merged.to_netcdf(temp_output)
        os.replace(temp_output, output)
    print(f"Saved {merged.sizes['time']} records, {len(merged.data_vars)} variables: {output}")


if __name__ == "__main__":
    main()
