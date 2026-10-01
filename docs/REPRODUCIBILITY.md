# Reproducibility notes

1. Create an environment with the scientific dependencies used by the pipeline (`xarray`, `numpy`, `pandas`, `netCDF4`, `dask`, `tqdm`, and the relevant provider clients), plus the application requirements.
2. Authenticate only through `data_pipeline/scripts/auth/`; never commit credentials or `.env` files.
3. Download the required source years.
4. Run preprocessing, source merge, mask/alignment, and normalization in that order.
5. Build validation features/targets before opening the evaluation notebooks.
6. Record source years, provider versions, and the checkpoint used for every reported result.

Small demo inputs and selected evaluation artifacts are included where useful. Large raw data and generated tensors are intentionally ignored.
