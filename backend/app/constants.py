LAT_MIN = 5.0
LAT_MAX = 30.0
LON_MIN = 45.0
LON_MAX = 105.0
GRID_STEP = 0.25

STANDARD_DEPTHS = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]

LATITUDES = [round(5.0 + i * 0.25, 2) for i in range(101)]  # 5.0 to 30.0 (101 values)
LONGITUDES = [round(45.0 + i * 0.25, 2) for i in range(241)]  # 45.0 to 105.0 (241 values)

NUM_LATS = 101
NUM_LONS = 241
NUM_DEPTHS = 15
NUM_SURFACE_FEATURES = 7

SURFACE_FEATURE_NAMES = [
    "sst_c",
    "sss_psu",
    "sla_m",
    "u_current_ms",
    "v_current_ms",
    "u_wind_ms",
    "v_wind_ms",
]
