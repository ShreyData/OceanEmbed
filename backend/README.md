# OceanEmbed backend

FastAPI backend for historical subsurface-temperature profiles and a database-backed mock prediction endpoint. PostgreSQL 16 runs in Docker; FastAPI runs locally in development.

## Setup (Windows PowerShell)

1. From the `backend` directory, start PostgreSQL and confirm it is healthy:

   ```powershell
   cd backend
   docker compose up -d postgres
   docker compose ps
   ```

2. Create/activate a virtual environment and install dependencies:

   ```powershell
   py -3.11 -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   Copy-Item .env.example .env
   ```

3. Initialize the schema, then place your NetCDF file into `backend/Data/` and import it:

   ```powershell
   python scripts\init_db.py
   python scripts\import_glorys.py
   ```

   Re-running either command is safe. The importer uses PostgreSQL COPY into a temporary staging table and ignores existing unique records. `docker compose down` preserves imported data; only `docker compose down -v` deletes the named database volume.

4. Verify data manually if desired:

   ```powershell
   docker exec -it oceanembed-postgres psql -U oceanembed -d oceanembed
   ```

   ```sql
   SELECT COUNT(*), MIN(date), MAX(date) FROM ocean_temperature_output;
   SELECT DISTINCT depth_m FROM ocean_temperature_output ORDER BY depth_m;
   ```

5. Start the API, open Swagger at http://localhost:8000/docs, and run the isolated API test suite:

   ```powershell
   uvicorn app.main:app --reload
   pytest
   ```

The tests monkeypatch database helpers and do not modify the development database.

The Docker database is published as `localhost:5433` in this checkout because a pre-existing local PostgreSQL service occupies port 5432. Inside Docker it remains PostgreSQL's standard port 5432.

## Endpoints

- `GET /health`
- `GET /api/v1/metadata/bounds`
- `GET /api/v1/metadata/depths`
- `GET /api/v1/metadata/available-dates`
- `GET /api/v1/ocean/historical?lat=15.25&lon=65.5&date=2020-01-15`
- `POST /api/v1/ocean/predict`

`/api/v1/ocean/historical` uses exact stored coordinates and supports optional `depths=0,5,100`. The prediction endpoint validates all seven surface observations, retains the requested target date, and currently returns a random stored historical profile for the requested coordinate. Its inference function is deliberately isolated in `app/model.py` so it can be replaced by a real model later without changing the API contract.
