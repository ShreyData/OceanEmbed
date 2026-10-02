#!/bin/bash
# ==============================================================================
# OceanEmbed — Turnkey AWS ECR & Lambda Deployment Script
# ==============================================================================
# Prerequisites:
# 1. AWS CLI installed and configured (`aws configure`)
# 2. Docker daemon running
# ==============================================================================

set -e

# Configurable variables (adjust if necessary)
AWS_REGION="${AWS_REGION:-ap-south-1}" # Default to Mumbai (ap-south-1) for lowest latency in India
ECR_REPO_NAME="oceanembed-backend"
LAMBDA_FUNCTION_NAME="oceanembed-inference-api"
IMAGE_TAG="latest"

echo "=========================================================="
echo "OceanEmbed AWS Lambda / ECR Deployment"
echo "Region: $AWS_REGION | Repository: $ECR_REPO_NAME"
echo "=========================================================="

# 1. Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "ERROR: Failed to retrieve AWS Account ID. Please verify 'aws configure'."
    exit 1
fi
echo "✓ AWS Account ID: $AWS_ACCOUNT_ID"

ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}"

# 2. Ensure ECR Repository exists
echo "Checking AWS ECR repository..."
aws ecr describe-repositories --repository-names "$ECR_REPO_NAME" --region "$AWS_REGION" >/dev/null 2>&1 || {
    echo "Creating new ECR repository: $ECR_REPO_NAME"
    aws ecr create-repository \
        --repository-name "$ECR_REPO_NAME" \
        --image-scanning-configuration scanOnPush=true \
        --region "$AWS_REGION"
}
echo "✓ ECR Repository ready: $ECR_URI"

# 3. Authenticate Docker with ECR
echo "Authenticating Docker with AWS ECR..."
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
echo "✓ Docker login to ECR successful."

# 4. Build Docker container image
echo "Building OceanEmbed container image (single-platform, no attestation)..."
cd "$(dirname "$0")"
docker build --provenance=false --platform linux/amd64 -t "${ECR_REPO_NAME}:${IMAGE_TAG}" .
docker tag "${ECR_REPO_NAME}:${IMAGE_TAG}" "${ECR_URI}:${IMAGE_TAG}"
echo "✓ Docker build complete."

# 5. Push Docker image to ECR
echo "Pushing image to AWS ECR (${ECR_URI}:${IMAGE_TAG})..."
docker push "${ECR_URI}:${IMAGE_TAG}"
echo "✓ Image successfully pushed to ECR."

# 6. Deploy or Update AWS Lambda Function
echo "Checking if Lambda function '$LAMBDA_FUNCTION_NAME' exists..."
if aws lambda get-function --function-name "$LAMBDA_FUNCTION_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
    echo "Updating existing Lambda function with latest image..."
    aws lambda update-function-code \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --image-uri "${ECR_URI}:${IMAGE_TAG}" \
        --region "$AWS_REGION"
    echo "Waiting for function update to complete..."
    aws lambda wait function-updated --function-name "$LAMBDA_FUNCTION_NAME" --region "$AWS_REGION"
    echo "✓ Lambda function updated successfully."
else
    echo "Creating new Lambda function: $LAMBDA_FUNCTION_NAME"
    DEFAULT_ROLE="arn:aws:iam::${AWS_ACCOUNT_ID}:role/AWSLambdaBasicExecutionRole"
    read -p "Enter Lambda Execution Role ARN [default: $DEFAULT_ROLE]: " ROLE_ARN
    ROLE_ARN="${ROLE_ARN:-$DEFAULT_ROLE}"
    
    aws lambda create-function \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --package-type Image \
        --code ImageUri="${ECR_URI}:${IMAGE_TAG}" \
        --role "$ROLE_ARN" \
        --timeout 60 \
        --memory-size 2048 \
        --region "$AWS_REGION"
    
    echo "Waiting for Lambda function to become active..."
    aws lambda wait function-active --function-name "$LAMBDA_FUNCTION_NAME" --region "$AWS_REGION"

    echo "Enabling public Lambda Function URL (CORS enabled)..."
    URL_RES=$(aws lambda create-function-url-config \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --auth-type NONE \
        --cors '{"AllowOrigins": ["*"], "AllowMethods": ["*"], "AllowHeaders": ["*"]}' \
        --region "$AWS_REGION" \
        --query FunctionUrl --output text)
        
    aws lambda add-permission \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --statement-id FunctionURLAllowPublicAccess \
        --action lambda:InvokeFunctionUrl \
        --principal "*" \
        --function-url-auth-type NONE \
        --region "$AWS_REGION" 2>/dev/null || true

    aws lambda add-permission \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --statement-id AllowInvokeFunction \
        --action lambda:InvokeFunction \
        --principal "*" \
        --region "$AWS_REGION" 2>/dev/null || true
        
    echo "=========================================================="
    echo "🎉 DEPLOYMENT COMPLETE!"
    echo "Your Public Backend API URL is:"
    echo "$URL_RES"
    echo "Set this in Vercel as: VITE_API_URL=$URL_RES"
    echo "=========================================================="
    exit 0
fi

# Print Function URL if already exists
EXISTING_URL=$(aws lambda get-function-url-config --function-name "$LAMBDA_FUNCTION_NAME" --region "$AWS_REGION" --query FunctionUrl --output text 2>/dev/null || true)
if [ -n "$EXISTING_URL" ]; then
    echo "=========================================================="
    echo "Backend is live at:"
    echo "$EXISTING_URL"
    echo "=========================================================="
fi
