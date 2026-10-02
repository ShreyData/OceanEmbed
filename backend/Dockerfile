FROM python:3.10-slim

# System dependencies for NetCDF/HDF5 C libraries
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libnetcdf-dev libhdf5-dev gcc g++ curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies (CPU-only PyTorch to minimize image footprint to ~1.2 GB)
COPY requirements.txt .
RUN pip install --no-cache-dir \
        fastapi==0.111.0 \
        uvicorn[standard]==0.30.1 \
        python-multipart==0.0.9 \
        mangum==0.17.0 \
        numpy==1.26.4 \
        scipy==1.13.1 \
        xarray==2024.3.0 \
        netCDF4==1.7.1 \
        h5netcdf==1.3.0 && \
    pip install --no-cache-dir \
        torch==2.3.1+cpu \
        --extra-index-url https://download.pytorch.org/whl/cpu

# AWS Lambda Web Adapter: allows seamless HTTP execution in AWS Lambda
# If deployed to AWS Lambda, it automatically translates Lambda events to HTTP on port 7860.
# If run locally or on ECS/App Runner, it remains passive and standard Uvicorn handles requests.
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.4 /lambda-adapter /opt/extensions/lambda-adapter

# Copy application code, precomputed benchmarks, masks, and model checkpoints
COPY app/ ./app/
COPY checkpoints/ ./checkpoints/
COPY data/ ./data/

# Environment configurations
ENV PORT=7860
ENV AWS_LWA_PORT=7860
ENV PYTHONUNBUFFERED=1

EXPOSE 7860

# Default CMD runs Uvicorn.
# In AWS Lambda:
#   - With Web Adapter: CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"] (default)
#   - With native Mangum: override CMD with ["app.main.handler"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1"]
