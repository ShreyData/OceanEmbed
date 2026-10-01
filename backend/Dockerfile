FROM python:3.10-slim

# System dependencies for NetCDF/HDF5
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libnetcdf-dev libhdf5-dev gcc g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir \
        fastapi==0.111.0 \
        uvicorn[standard]==0.30.1 \
        python-multipart==0.0.9 \
        numpy==1.26.4 \
        xarray==2024.3.0 \
        netCDF4==1.7.1 \
        h5netcdf==1.3.0 && \
    pip install --no-cache-dir \
        torch==2.3.1+cpu \
        --extra-index-url https://download.pytorch.org/whl/cpu

# Copy application code
COPY app/ ./app/
COPY checkpoints/ ./checkpoints/

# Hugging Face Spaces runs as non-root user
RUN useradd -m -u 1000 hfuser && chown -R hfuser /app
USER hfuser

EXPOSE 7860

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1"]
