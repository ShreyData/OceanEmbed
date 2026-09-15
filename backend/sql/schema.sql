CREATE TABLE IF NOT EXISTS ocean_temperature_output (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    depth_m INTEGER NOT NULL,
    temperature_c DOUBLE PRECISION NOT NULL,
    CONSTRAINT uq_ocean_temperature
        UNIQUE (date, latitude, longitude, depth_m)
);

CREATE INDEX IF NOT EXISTS idx_ocean_temperature_lookup
ON ocean_temperature_output (date, latitude, longitude);
