from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .constants import (
    LAT_MAX,
    LAT_MIN,
    LON_MAX,
    LON_MIN,
    NUM_LATS,
    NUM_LONS,
    NUM_SURFACE_FEATURES,
    SURFACE_FEATURE_NAMES,
)


class StrictSchema(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Location(StrictSchema):
    lat: float = Field(ge=LAT_MIN, le=LAT_MAX)
    lon: float = Field(ge=LON_MIN, le=LON_MAX)


class PredictionRequest(StrictSchema):
    target_date: date = Field(strict=False)
    surface_observations: Any = Field(...)

    @field_validator("surface_observations", mode="before")
    @classmethod
    def validate_surface_observations(cls, v: Any) -> Any:
        # Option 1: 3D array of shape 7 x 101 x 241
        if isinstance(v, list):
            if len(v) != NUM_SURFACE_FEATURES:
                raise ValueError(
                    f"surface_observations array must have {NUM_SURFACE_FEATURES} feature channels, got {len(v)}."
                )
            for ch_idx, channel in enumerate(v):
                if not isinstance(channel, list) or len(channel) != NUM_LATS:
                    got = len(channel) if isinstance(channel, list) else type(channel).__name__
                    raise ValueError(
                        f"Channel {ch_idx} must have {NUM_LATS} latitude rows, got {got}."
                    )
                for row_idx, row in enumerate(channel):
                    if not isinstance(row, list) or len(row) != NUM_LONS:
                        got = len(row) if isinstance(row, list) else type(row).__name__
                        raise ValueError(
                            f"Channel {ch_idx}, row {row_idx} must have {NUM_LONS} longitude columns, got {got}."
                        )
                    for col_idx, val in enumerate(row):
                        if val is not None and not isinstance(val, (int, float)):
                            raise ValueError(
                                f"Channel {ch_idx}, row {row_idx}, col {col_idx} has invalid non-numeric value: {val!r}."
                            )
            return v

        # Option 2: Dict of 7 named feature matrices each of shape 101 x 241
        elif isinstance(v, dict):
            required = set(SURFACE_FEATURE_NAMES)
            missing = required - set(v.keys())
            if missing:
                raise ValueError(
                    f"surface_observations dictionary is missing required features: {sorted(missing)}."
                )
            for name in SURFACE_FEATURE_NAMES:
                matrix = v[name]
                if not isinstance(matrix, list) or len(matrix) != NUM_LATS:
                    got = len(matrix) if isinstance(matrix, list) else type(matrix).__name__
                    raise ValueError(
                        f"Feature '{name}' must have {NUM_LATS} latitude rows, got {got}."
                    )
                for row_idx, row in enumerate(matrix):
                    if not isinstance(row, list) or len(row) != NUM_LONS:
                        got = len(row) if isinstance(row, list) else type(row).__name__
                        raise ValueError(
                            f"Feature '{name}', row {row_idx} must have {NUM_LONS} longitude columns, got {got}."
                        )
                    for col_idx, val in enumerate(row):
                        if val is not None and not isinstance(val, (int, float)):
                            raise ValueError(
                                f"Feature '{name}', row {row_idx}, col {col_idx} has invalid non-numeric value: {val!r}."
                            )
            return v

        raise ValueError(
            f"surface_observations must be a 3D tensor of shape {NUM_SURFACE_FEATURES} x {NUM_LATS} x {NUM_LONS} "
            f"or a dictionary of {NUM_SURFACE_FEATURES} feature matrices each of shape {NUM_LATS} x {NUM_LONS}."
        )
