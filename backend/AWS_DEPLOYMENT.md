# OceanEmbed — AWS ECR & Lambda Container Deployment Guide

This guide walks you through deploying the **OceanEmbed Subsurface Temperature Reconstruction Backend** to **AWS Lambda via AWS ECR** for your 2-month evaluation period.

---

## Architecture Overview

```
                      ┌────────────────────────────────┐
                      │    Vercel Frontend (React)     │
                      │     https://oceanembed.app     │
                      └──────────────┬─────────────────┘
                                     │ HTTPS
                                     ▼
                      ┌────────────────────────────────┐
                      │    AWS Lambda Function URL     │
                      │   (Free public HTTPS endpoint) │
                      └──────────────┬─────────────────┘
                                     │
                      ┌──────────────▼─────────────────┐
                      │    OceanEmbed Container (ECR)  │
                      │ ────────────────────────────── │
                      │  • AWS Lambda Web Adapter      │
                      │  • Uvicorn + FastAPI           │
                      │  • 12 Precomputed Demo Caches  │
                      │  • PyTorch Neural Inference    │
                      │  • CF-Standard NetCDF Parser   │
                      └────────────────────────────────┘
```

### Key Performance & Cost Metrics
- **Demo Scenarios (12 Curated Dates)**: Served in **~25 ms** from compressed in-memory cache.
- **Custom NetCDF Uploads**: Real PyTorch neural forward pass executes in **~350–480 ms** on 2 vCPUs.
- **Monthly Cost**: **Near $0.00** during evaluation (fits within AWS Free Tier: 1M Lambda requests/month, 3.2M seconds of compute, and Lambda Function URL has no API Gateway fees).

---

## Step 1: Prerequisites

1. **AWS CLI** installed and configured:
   ```bash
   aws configure
   # Enter AWS Access Key ID, Secret Access Key, and default region (e.g., ap-south-1)
   ```
2. **Docker Daemon** installed and running on your system:
   ```bash
   docker --version
   ```

---

## Step 2: Automated Turnkey Deployment (Recommended)

Run the automated deployment script from the `backend` directory:

```bash
cd backend
./deploy_aws.sh
```

The script will automatically:
1. Authenticate Docker with your AWS ECR registry.
2. Create the ECR repository `oceanembed-backend` if it does not already exist.
3. Build the container image with CPU-only PyTorch and AWS Lambda Web Adapter.
4. Push the image to AWS ECR.
5. Create or update your AWS Lambda function (`oceanembed-inference-api`) with 2048 MB RAM and 60s timeout.
6. Generate a public **Lambda Function URL** with CORS enabled.

---

## Step 3: Manual Deployment Steps (If Not Using the Script)

If you prefer to run each step manually:

### 1. Authenticate with AWS ECR
```bash
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <AWS_ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com
```

### 2. Create ECR Repository
```bash
aws ecr create-repository --repository-name oceanembed-backend --region ap-south-1
```

### 3. Build & Tag Container Image
```bash
cd backend
docker build -t oceanembed-backend:latest .
docker tag oceanembed-backend:latest <AWS_ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/oceanembed-backend:latest
```

### 4. Push to ECR
```bash
docker push <AWS_ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/oceanembed-backend:latest
```

### 5. Create Lambda Function
In the AWS Console (or via CLI):
- Go to **AWS Lambda** → **Create function**.
- Select **Container image**.
- Function name: `oceanembed-inference-api`.
- Container image URI: Select the image pushed to `oceanembed-backend`.
- Architecture: `x86_64`.
- Under **Configuration** → **General configuration**:
  - Memory: **2048 MB** (Allocates 2 dedicated vCPUs for fast PyTorch tensor operations).
  - Timeout: **60 seconds** (Prevents timeouts on cold starts).
  - Ephemeral storage: **1024 MB** (Default 512 MB is also fine).

### 6. Enable Lambda Function URL (Public HTTPS)
- Go to your function in the AWS Lambda Console.
- Navigate to **Configuration** → **Function URL** → **Create Function URL**.
- Auth type: `NONE` (Publicly accessible).
- Check **Configure cross-origin resource sharing (CORS)**:
  - Allow origins: `*` (or your Vercel domain `https://your-app.vercel.app`).
  - Allow methods: `*` (GET, POST, OPTIONS).
  - Allow headers: `*`.
- Click **Save**.
- Copy your generated URL:
  `https://<unique-id>.lambda-url.ap-south-1.on.aws/`

---

## Step 4: Link Backend to Vercel Frontend

1. Go to your **Vercel Project Dashboard**.
2. Navigate to **Settings** → **Environment Variables**.
3. Add a new variable:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://<unique-id>.lambda-url.ap-south-1.on.aws` (no trailing slash)
4. Redeploy your frontend on Vercel.

---

## Verification & Testing

### Test Health Endpoint:
```bash
curl https://<unique-id>.lambda-url.ap-south-1.on.aws/health
```
Expected response:
```json
{
  "status": "healthy",
  "model_loaded": true,
  "engine": "OceanEmbed-v2",
  "deployment_target": "AWS Lambda (ECR Container) / Standalone",
  "precomputed_cache_available": true,
  "precomputed_dates_count": 12
}
```

### Test Prediction with Demo File:
```bash
curl -X POST -F "file=@demo_2022_09_23.nc" https://<unique-id>.lambda-url.ap-south-1.on.aws/predict
```
Expected response:
```json
{
  "status": "success",
  "latency_ms": 24.5,
  "inference_mode": "demo_cache",
  "has_ground_truth": true
}
```
