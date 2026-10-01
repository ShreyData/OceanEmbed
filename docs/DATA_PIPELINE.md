# Data pipeline guide

The pipeline uses a shared 0.25° grid over 5–30°N and 45–105°E and produces aligned NetCDF tensors for the model.

| Stage | Location | Output |
| --- | --- | --- |
| Authentication | `data_pipeline/scripts/auth/` | Provider credentials stored locally |
| Download | `data_pipeline/scripts/download/` | `data_pipeline/data/raw/<source>/Down/` |
| Monthly preprocessing | `data_pipeline/scripts/preprocess/` | `data_pipeline/data/raw/<source>/<Source>/` |
| Source merge | `data_pipeline/scripts/assemble/merge_*.py` | Master source tensors |
| Mask and alignment | `create_land_mask.py`, `apply_land_mask.py` | `data_pipeline/data/processed/model_ready/` |
| Normalization | `normalize_datasets.py` | `data_pipeline/data/processed/ml_ready/` |
| Validation | `build_validation_*.py`, `build_argo_evaluation.py` | `models/evaluation/data/` |

The notebooks are numbered by purpose: exploration, monthly preparation, masking/alignment, normalization, and regional training. Evaluation notebooks and reports are isolated under `models/evaluation/` so reviewers can distinguish data construction from model assessment.
