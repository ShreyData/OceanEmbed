#!/usr/bin/env python3
"""Create the normalized validation GLORYS target for 2022-2024.

The 2022 target is taken from the existing normalized training target. The
2023-2024 standardized monthly GLORYS files are merged, masked with the
existing 3D ocean mask, and normalized with the training thetao statistics.
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


ROOT = Path(__file__).resolve().parents[3]
YEARS = (2022, 2023, 2024)
LAST_DATE = pd.Timestamp("2024-12-15")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("models/evaluation/data/target_normalized.nc"),
    )
    return parser.parse_args()


def resolve(root: Path, path: Path) -> Path:
    return path if path.is_absolute() else root / path


def get_monthly_files(root: Path) -> list[tuple[int, int, Path]]:
    directory = root / "data_pipeline/data/raw/glorys/Target"
    pattern = re.compile(r"^glorys_target_thetao_(2022|2023|2024)_(\d{2})\.nc$")
    found = {}
    for path in directory.glob("*.nc"):
        match = pattern.match(path.name)
        if match:
            found[(int(match.group(1)), int(match.group(2)))] = path
    missing = [(year, month) for year in YEARS for month in range(1, 13) if (year, month) not in found]
    if missing:
        raise FileNotFoundError("Missing GLORYS target month(s): " + ", ".join(f"{y}-{m:02d}" for y, m in missing))
    return [(year, month, found[(year, month)]) for year in YEARS for month in range(1, 13)]


def canonical_month(ds: xr.Dataset, year: int, month: int, path: Path) -> xr.Dataset:
    expected = pd.Period(f"{year}-{month:02d}").days_in_month
    records = ds.sizes.get("time")
    partial = year == 2024 and month == 12 and records == 15
    if records != expected and not partial:
        raise ValueError(f"{path}: expected {expected} daily records, found {records}")
    return ds.assign_coords(time=pd.date_range(f"{year}-{month:02d}-01", periods=records, freq="D"))


def load_mask(root: Path) -> xr.DataArray:
    path = root / "data_pipeline/data/processed/ml_ready/ocean_mask_3d.nc"
    with xr.open_dataset(path, decode_times=False) as source:
        mask = source["ocean_mask"].load()
    return mask.astype(bool)


def load_training_target_2022(root: Path) -> xr.Dataset:
    path = root / "data_pipeline/data/processed/ml_ready/target_normalized.nc"
    with xr.open_dataset(path, decode_times=True) as source:
        ds = source.sel(time=slice("2022-01-01", "2022-12-31")).load()
    if ds.sizes.get("time") != 365:
        raise ValueError(f"Expected 365 normalized 2022 target records, found {ds.sizes.get('time')}")
    if not np.isfinite(ds["thetao"].values).all():
        raise ValueError("Existing normalized 2022 target contains non-finite values")
    return ds


def load_raw_2023_2024(root: Path, mask: xr.DataArray, mean: float, std: float) -> xr.Dataset:
    pieces = []
    for year, month, path in get_monthly_files(root):
        if year == 2022:
            continue
        with xr.open_dataset(path, decode_times=True) as source:
            if "thetao" not in source.data_vars:
                raise KeyError(f"{path}: thetao variable is missing")
            piece = source[["thetao"]].load()
        piece = canonical_month(piece, year, month, path)
        piece = piece.where(mask)
        piece["thetao"] = ((piece["thetao"] - mean) / std).fillna(0.0).astype(np.float32)
        pieces.append(piece)
    return xr.concat(pieces, dim="time").sortby("time")


def main() -> None:
    options = parse_args()
    root = options.root.resolve()
    output = resolve(root, options.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    stats_path = root / "data_pipeline/data/processed/ml_ready/normalization_stats.json"
    with stats_path.open() as handle:
        thetao_stats = json.load(handle)["thetao"]
    mask = load_mask(root)

    print("Loading normalized 2022 target...")
    target_2022 = load_training_target_2022(root)
    print("Processing, masking, and normalizing 2023-2024 targets...")
    target_23_24 = load_raw_2023_2024(root, mask, thetao_stats["mean"], thetao_stats["std"])
    target_23_24 = target_23_24.sel(time=slice("2022-01-01", LAST_DATE))

    target = xr.concat([target_2022, target_23_24], dim="time").sortby("time")
    if target.sizes.get("time") != 1080:
        raise ValueError(f"Expected 1080 validation records through {LAST_DATE.date()}, found {target.sizes.get('time')}")
    if not np.isfinite(target["thetao"].values).all():
        raise ValueError("Final normalized validation target contains non-finite values")

    with tempfile.TemporaryDirectory(prefix="validation_target_", dir=output.parent) as temp_dir:
        temporary = Path(temp_dir) / output.name
        target.to_netcdf(temporary)
        os.replace(temporary, output)
    print(f"Saved {target.sizes['time']} target records to {output}")


if __name__ == "__main__":
    main()
