"""Create the idempotent PostgreSQL schema for OceanEmbed."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg
from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def database_url() -> str:
    load_dotenv(BACKEND_ROOT / ".env")
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set. Copy .env.example to .env and configure it.")
    return url


def main() -> int:
    try:
        with psycopg.connect(database_url()) as conn:
            with conn.cursor() as cur:
                cur.execute((BACKEND_ROOT / "sql" / "schema.sql").read_text(encoding="utf-8"))
            conn.commit()
    except (psycopg.Error, RuntimeError) as exc:
        print(f"Could not initialize PostgreSQL: {exc}", file=sys.stderr)
        print("Ensure `docker compose up -d postgres` has completed successfully.", file=sys.stderr)
        return 1
    print("Database schema is ready; existing rows were preserved.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
