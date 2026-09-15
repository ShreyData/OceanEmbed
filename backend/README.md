# OceanEmbed Backend

FastAPI backend providing historical subsurface-temperature profiles and a database-backed mock prediction endpoint. PostgreSQL 16 runs via Docker; FastAPI runs locally during development.

---

## Prerequisites

- **Docker** & **Docker Compose** installed and running
- **Python 3.10+** (recommended: Python 3.11)
- The dataset file `glorys_target_thetao_2020_01.nc` is already included directly in `backend/Data/`.

---

## Setup & Running

All commands below should be executed from within the `backend/` directory:

```bash
cd backend
```

### 1. Start PostgreSQL (Docker)

Start the PostgreSQL 16 container in the background:

```bash
docker compose up -d postgres
```

Verify that the container is running and healthy:

```bash
docker compose ps
```

> **Note on Ports:** The PostgreSQL container port `5432` is mapped to host port **`5433`** (defined in `docker-compose.yml`) to avoid conflicts with any pre-existing local PostgreSQL service. Database credentials default to:
> - **Host:** `localhost`
> - **Port:** `5433`
> - **Database:** `oceanembed`
> - **User:** `oceanembed`
> - **Password:** `oceanembed`

---

### 2. Set Up Virtual Environment & Dependencies

#### **On Linux / macOS (Bash / Zsh):**

```bash
# Create virtual environment
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create environment configuration from template
cp .env.example .env
```

#### **On Windows (PowerShell):**

```powershell
# Create virtual environment
py -3.11 -m venv .venv

# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Create environment configuration from template
Copy-Item .env.example .env
```

#### **On Windows (Command Prompt - cmd.exe):**

```cmd
:: Create virtual environment
py -3.11 -m venv .venv

:: Activate virtual environment
.venv\Scripts\activate.bat

:: Install dependencies
pip install -r requirements.txt

:: Create environment configuration from template
copy .env.example .env
```

---

### 3. Initialize Database & Import Dataset

The NetCDF dataset file (`backend/Data/glorys_target_thetao_2020_01.nc`) is already checked into GitHub in the `backend/Data/` folder.

Run the schema initializer followed by the bulk import script:

#### **On Linux / macOS:**

```bash
python3 scripts/init_db.py
python3 scripts/import_glorys.py
```

#### **On Windows (PowerShell or CMD):**

```powershell
python scripts\init_db.py
python scripts\import_glorys.py
```

> **Idempotent Execution:**
> - `init_db.py` creates tables and indices using `IF NOT EXISTS`. Existing tables are left untouched.
> - `import_glorys.py` copies records via a staging table and applies `ON CONFLICT DO NOTHING`. Re-running it will not generate duplicate rows.
> - By default, `import_glorys.py` reads `backend/Data/glorys_target_thetao_2020_01.nc`. Custom file paths can be supplied via the `--input` flag:
>   ```bash
>   python scripts/import_glorys.py --input Data/custom_file.nc
>   ```

---

### 4. Verify Database (Optional)

To check the imported data in PostgreSQL directly:

```bash
docker exec -it oceanembed-postgres psql -U oceanembed -d oceanembed
```

Inside the PostgreSQL prompt:

```sql
-- Count imported records and check date boundaries
SELECT COUNT(*), MIN(date), MAX(date) FROM ocean_temperature_output;

-- Check available standard depths
SELECT DISTINCT depth_m FROM ocean_temperature_output ORDER BY depth_m;

-- Exit psql
\q
```

---

### 5. Run the Test Suite

Run the isolated API test suite:

#### **On Linux / macOS:**

```bash
pytest
```

#### **On Windows:**

```powershell
pytest
```

*(Tests mock the database layer and run isolated against mock objects without affecting your development database).*

---

### 6. Start the FastAPI Server

Start the local server with auto-reload:

```bash
uvicorn app.main:app --reload --port 8000
```

Once running, access:
- **Interactive Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc Documentation:** [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check Endpoint:** [http://localhost:8000/health](http://localhost:8000/health)

---

## Stopping & Teardown

- **Stop PostgreSQL container (preserves imported data):**
  ```bash
  docker compose down
  ```

- **Stop PostgreSQL and delete persistent database volume (wipes all data):**
  ```bash
  docker compose down -v
  ```

---

## API Endpoints Overview

- `GET /health` — Health check endpoint
- `GET /api/v1/metadata/bounds` — Geospatial boundaries (`lat_min=5.0`, `lat_max=30.0`, `lon_min=45.0`, `lon_max=105.0`, `step=0.25`)
- `GET /api/v1/metadata/depths` — Supported standard depth levels in meters (15 depths: `0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000`)
- `GET /api/v1/metadata/available-dates` — Date range of available data
- `GET /api/v1/ocean/historical?date=2020-01-01` — **3D Volumetric Cube**:
  - Parameters: `date` (required), optional `lat_min`, `lat_max`, `lon_min`, `lon_max`, `depths` (e.g. `0,50,100`), or point `lat`, `lon`.
  - Output: Tensor of shape `[15, 101, 241]` (or sliced sub-cube) containing temperature values (`null` for land coordinates).
- `POST /api/v1/ocean/predict` — **Subsurface Temperature 3D Cube Prediction**:
  - Input: `target_date`, plus `surface_observations` validated strictly as **$7 \times 101 \times 241$** (accepts either a 3D array or a dictionary of 7 feature matrices: `sst_c`, `sss_psu`, `sla_m`, `u_current_ms`, `v_current_ms`, `u_wind_ms`, `v_wind_ms`).
  - Output: Reconstructed 3D cube of shape **$15 \times 101 \times 241$** (currently returns random real GLORYS day as mock inference, isolated in [`app/model.py`](file:///home/shrey/Data/SIH%202k26/backend/app/model.py)).
