# OceanEmbed

OceanEmbed is an ocean-temperature modelling project with a reproducible data pipeline, model-training notebooks, evaluation artifacts, and an API application.

## Repository map

```text
data_pipeline/
├── scripts/       # auth, download, preprocess, assemble, and regional steps
├── data/          # raw, processed, and regional scientific artifacts
├── notebooks/     # exploration, preparation, and training notebooks
└── examples/      # small demonstration inputs
models/evaluation/ # evaluation notebooks, reports, exports, and checkpoints
docs/              # pipeline and reproducibility documentation
backend/           # API application (unchanged)
frontend/          # UI application (unchanged, when present)
```

## Data and model flow

1. Authenticate with the providers in `data_pipeline/scripts/auth/`.
2. Download GLORYS, SST, SSS, SSH, winds, and currents into `data_pipeline/data/raw/`.
3. Standardize each source with `data_pipeline/scripts/preprocess/`.
4. Merge, mask, align, and normalize with `data_pipeline/scripts/assemble/`.
5. Build validation data and run the notebooks in `models/evaluation/notebooks/`.

See [`docs/DATA_PIPELINE.md`](docs/DATA_PIPELINE.md) for the stage-by-stage artifact map and [`docs/REPRODUCIBILITY.md`](docs/REPRODUCIBILITY.md) for evaluation instructions.

## Quick start

Run commands from the repository root and use `--help` before downloading data:

```bash
python data_pipeline/scripts/auth/copernicus_login.py
python data_pipeline/scripts/download/download_sst_year.py --year 2022
python data_pipeline/scripts/preprocess/preprocess_sst_all.py
python data_pipeline/scripts/assemble/merge_sst.py
python data_pipeline/scripts/assemble/apply_land_mask.py
python data_pipeline/scripts/assemble/normalize_datasets.py
```

Credentials, downloaded data, caches, and generated outputs are ignored by default to keep the submission reviewable.
