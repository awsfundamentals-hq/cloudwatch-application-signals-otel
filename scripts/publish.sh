#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

set -e

# Parse command line arguments to extract the stage parameter
STAGE="dev"  # Default stage
for arg in "$@"; do
  case $arg in
    --stage=*)
      STAGE="${arg#*=}"
      shift
      ;;
    *)
      # Unknown option
      ;;
  esac
done

echo "Using stage: $STAGE"

aws sts get-caller-identity --query User.Arn > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "Error: You are not logged into AWS. Please run 'aws configure' to set up your AWS credentials."
  exit 1
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account ID: $AWS_ACCOUNT_ID"

# Find the ECR repository matching the pattern ecs-fargate-$STAGE-ecr
REPO_NAME_PATTERN="ecs-fargate-$STAGE-ecr"
echo "Looking for ECR repository with pattern: $REPO_NAME_PATTERN"

# Query AWS ECR for repositories and find the matching one
REPO_NAME=$(aws ecr describe-repositories --region us-east-1 --query "repositories[?starts_with(repositoryName, '$REPO_NAME_PATTERN')].repositoryName" --output text | head -n1)

if [ -z "$REPO_NAME" ]; then
  echo "Error: No ECR repository found matching pattern '$REPO_NAME_PATTERN'."
  echo "Make sure you have deployed the infrastructure with: npx sst deploy --stage=$STAGE"
  exit 1
fi

echo "Found ECR repository: $REPO_NAME"
REPO_URL=$AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/$REPO_NAME

aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $REPO_URL

echo "Repository URL: $REPO_URL"
echo "Script Directory: $SCRIPT_DIR"
echo "Backend Directory: $BACKEND_DIR"

# Change to backend directory where Dockerfile is located
BACKEND_DIR="$SCRIPT_DIR/../backend"
pushd $BACKEND_DIR > /dev/null
  docker buildx build --platform linux/amd64 -t $REPO_NAME --load .
  docker tag $REPO_NAME:latest $REPO_URL:latest
  docker push $REPO_URL:latest
popd > /dev/null

echo -e "\033[32mSuccessfully pushed our image to ECR! 🚀\033[0m"

# Force new deployment for ECS service
SERVICE_NAME="ecs-fargate-$STAGE-ecs"
CLUSTER_NAME="ecs-fargate-$STAGE-ecs"

echo "Forcing new deployment for ECS service: $SERVICE_NAME in cluster: $CLUSTER_NAME"

# Check if the ECS service exists
aws ecs describe-services --region us-east-1 --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME" --query "services[0].serviceName" --output text > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "Error: ECS service '$SERVICE_NAME' not found in cluster '$CLUSTER_NAME'."
  echo "Make sure the service is deployed with: npx sst deploy --stage=$STAGE"
  exit 1
fi

# Force new deployment
aws ecs update-service --region us-east-1 --cluster "$CLUSTER_NAME" --service "$SERVICE_NAME" --force-new-deployment > /dev/null

if [ $? -eq 0 ]; then
  echo -e "\033[32mSuccessfully forced new ECS deployment! 🔄\033[0m"
else
  echo -e "\033[31mFailed to force new ECS deployment ❌\033[0m"
  exit 1
fi
