#!/bin/bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

set -e

aws sts get-caller-identity --query User.Arn > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "Error: You are not logged into AWS. Please run 'aws configure' to set up your AWS credentials."
  exit 1
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REPO_URL=$AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/awsfundamentals

aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $REPO_URL

pushd $SCRIPT_DIR > /dev/null

  docker build -t awsfundamentals .
  docker tag awsfundamentals:latest $REPO_URL:latest
  docker push $REPO_URL:latest

popd > /dev/null

echo -e "\033[32mSuccessfully pushed our image to ECR! 🚀\033[0m"