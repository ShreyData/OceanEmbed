from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict, Field

from .constants import LAT_MAX, LAT_MIN, LON_MAX, LON_MIN


class StrictSchema(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Location(StrictSchema):
    lat: float = Field(ge=LAT_MIN, le=LAT_MAX)
    lon: float = Field(ge=LON_MIN, le=LON_MAX)


class SurfaceObservations(StrictSchema):
    sst_c: float
    sss_psu: float
    sla_m: float
    u_current_ms: float
    v_current_ms: float
    u_wind_ms: float
    v_wind_ms: float


class PredictionRequest(StrictSchema):
    # JSON sends dates as ISO strings; retain strict validation for all numeric model inputs.
    target_date: date = Field(strict=False)
    location: Location
    surface_observations: SurfaceObservations
