from __future__ import annotations

import math
from datetime import date
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .constants import (
    LAT_MAX, LAT_MIN, LON_MAX, LON_MIN,
    NUM_LATS, NUM_LONS, NUM_SURFACE_FEATURES, SURFACE_FEATURE_NAMES,
)

# Float16 finite range
_F16_MAX = 65504.0
_F16_MIN = -65504.0

# Minimum fraction of non-null cells required across the whole tensor
_MIN_COVERAGE = 0.05   # at least 5% of cells must have a real value


class StrictSchema(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Location(StrictSchema):
    lat: float = Field(ge=LAT_MIN, le=LAT_MAX)
    lon: float = Field(ge=LON_MIN, le=LON_MAX)


def _validate_value(val: Any, label: str) -> None:
    """Raise ValueError if val is not a valid numeric cell (float16 range, no NaN/Inf)."""
    if val is None:
        return
    if not isinstance(val, (int, float)):
        raise ValueError(f"{label} has non-numeric value: {val!r}.")
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        raise ValueError(f"{label} has non-finite value: {val!r}. Use null for missing cells.")
    if not (_F16_MIN <= val <= _F16_MAX):
        raise ValueError(f"{label} value {val} is out of float16 range [{_F16_MIN}, {_F16_MAX}].")


def _check_coverage(total_cells: int, null_count: int) -> None:
    coverage = 1.0 - null_count / total_cells
    if coverage < _MIN_COVERAGE:
        raise ValueError(
            f"surface_observations is almost entirely null ({coverage:.1%} coverage). "
            f"At least {_MIN_COVERAGE:.0%} of cells must have a real value."
        )


class PredictionRequest(StrictSchema):
    target_date: date = Field(strict=False)
    surface_observations: Any = Field(...)

    @field_validator("surface_observations", mode="before")
    @classmethod
    def validate_surface_observations(cls, v: Any) -> Any:
        # ── 3-D tensor [7][101][241] ──────────────────────────────────────
        if isinstance(v, list):
            if len(v) != NUM_SURFACE_FEATURES:
                raise ValueError(
                    f"Expected {NUM_SURFACE_FEATURES} feature channels (one per surface variable), got {len(v)}."
                )
            null_count = 0
            for ch, channel in enumerate(v):
                if not isinstance(channel, list) or len(channel) != NUM_LATS:
                    got = len(channel) if isinstance(channel, list) else type(channel).__name__
                    raise ValueError(f"Channel {ch} must have {NUM_LATS} latitude rows, got {got}.")
                for row_i, row in enumerate(channel):
                    if not isinstance(row, list) or len(row) != NUM_LONS:
                        got = len(row) if isinstance(row, list) else type(row).__name__
                        raise ValueError(f"Channel {ch}, row {row_i} must have {NUM_LONS} longitude columns, got {got}.")
                    for col_i, val in enumerate(row):
                        _validate_value(val, f"Channel {ch}, row {row_i}, col {col_i}")
                        if val is None:
                            null_count += 1
            _check_coverage(NUM_SURFACE_FEATURES * NUM_LATS * NUM_LONS, null_count)
            return v

        # ── Named dict {feature: [101][241]} ─────────────────────────────
        if isinstance(v, dict):
            missing = set(SURFACE_FEATURE_NAMES) - set(v.keys())
            if missing:
                raise ValueError(f"surface_observations is missing required features: {sorted(missing)}.")
            extra = set(v.keys()) - set(SURFACE_FEATURE_NAMES)
            if extra:
                raise ValueError(f"surface_observations has unexpected features: {sorted(extra)}.")
            null_count = 0
            for name in SURFACE_FEATURE_NAMES:
                matrix = v[name]
                if not isinstance(matrix, list) or len(matrix) != NUM_LATS:
                    got = len(matrix) if isinstance(matrix, list) else type(matrix).__name__
                    raise ValueError(f"Feature '{name}' must have {NUM_LATS} latitude rows, got {got}.")
                for row_i, row in enumerate(matrix):
                    if not isinstance(row, list) or len(row) != NUM_LONS:
                        got = len(row) if isinstance(row, list) else type(row).__name__
                        raise ValueError(f"Feature '{name}', row {row_i} must have {NUM_LONS} longitude columns, got {got}.")
                    for col_i, val in enumerate(row):
                        _validate_value(val, f"Feature '{name}', row {row_i}, col {col_i}")
                        if val is None:
                            null_count += 1
            _check_coverage(NUM_SURFACE_FEATURES * NUM_LATS * NUM_LONS, null_count)
            return v

        raise ValueError(
            f"surface_observations must be a 3-D tensor [{NUM_SURFACE_FEATURES}][{NUM_LATS}][{NUM_LONS}] "
            f"or a named dict of {NUM_SURFACE_FEATURES} feature matrices each [{NUM_LATS}][{NUM_LONS}]."
        )
