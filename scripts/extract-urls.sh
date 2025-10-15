#!/bin/bash

# Extract infrastructure URLs from AWS
# Usage: ./extract-urls.sh --stage=dev

set -e

# Default values
APP_NAME="ecs-fargate"
OUTPUT_FILE="output.json"

# Parse command line arguments
STAGE=""

for arg in "$@"; do
  case $arg in
    --stage=*)
      STAGE="${arg#*=}"
      shift
      ;;
    *)
      echo "❌ Unknown argument: $arg"
      exit 1
      ;;
  esac
done

# Validate required parameters
if [[ -z "$STAGE" ]]; then
  echo "❌ Error: --stage parameter is required"
  echo "   Usage: $0 --stage=dev"
  exit 1
fi

# Function to get API Gateway URL
get_api_gateway_url() {
  local stage=$1
  local api_name="${APP_NAME}-${stage}-ecs"
  
  echo "🔍 Searching for API Gateway in stage: $stage" >&2
  
  # First, get the API ID
  local api_id
  api_id=$(aws apigatewayv2 get-apis \
    --query "Items[?Name=='${api_name}'].ApiId" \
    --output text 2>/dev/null || echo "None")
    
  if [[ -n "$api_id" && "$api_id" != "None" && "$api_id" != "" ]]; then
    # Get the region from AWS CLI configuration
    local region
    region=$(aws configure get region)
    local api_url="https://${api_id}.execute-api.${region}.amazonaws.com/${stage}"
    
    echo "✅ Found API Gateway: $api_url" >&2
    echo "$api_url"
  else
    echo "⚠️  No API Gateway found for stage: $stage" >&2
    return 1
  fi
}

# Function to get Lambda Function URL
get_lambda_function_url() {
  local stage=$1
  local function_name="${APP_NAME}-${stage}-lambda"
  
  echo "🔍 Searching for Lambda Function in stage: $stage" >&2
  
  local lambda_url
  lambda_url=$(aws lambda get-function-url-config \
    --function-name "$function_name" \
    --query "FunctionUrl" \
    --output text 2>/dev/null || echo "None")
  
  if [[ -n "$lambda_url" && "$lambda_url" != "None" && "$lambda_url" != "" ]]; then
    echo "✅ Found Lambda Function: $lambda_url" >&2
    echo "$lambda_url"
  else
    echo "⚠️  No Lambda Function URL found for stage: $stage" >&2
    return 1
  fi
}

# Function to create/update the complete JSON file
create_output_json() {
  local lb_url=$1
  local lambda_url=$2
  local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
  
  local temp_file
  temp_file=$(mktemp)
  
  # Create the JSON structure
  jq -n \
    --arg api_url "$api_url" \
    --arg lambda_url "$lambda_url" \
    --arg timestamp "$timestamp" \
    '{
      "apiGatewayUrl": (if $api_url == "" then null else $api_url end),
      "lambdaFunctionUrl": (if $lambda_url == "" then null else $lambda_url end),
      "extractedAt": $timestamp
    }' > "$temp_file" && mv "$temp_file" "$OUTPUT_FILE"
}

# Main execution
echo "🚀 Extracting infrastructure URLs for stage: $STAGE"

# Extract API Gateway URL
api_url=""
if url=$(get_api_gateway_url "$STAGE"); then
  api_url="$url"
fi

# Extract Lambda Function URL  
lambda_url=""
if url=$(get_lambda_function_url "$STAGE"); then
  lambda_url="$url"
fi

# Create the output file
create_output_json "$api_url" "$lambda_url"

echo "✅ URLs extracted successfully!"
echo "📁 Written to: $OUTPUT_FILE"

if [[ -n "$api_url" ]]; then
  echo "🌐 API Gateway URL: $api_url"
fi

if [[ -n "$lambda_url" ]]; then
  echo "⚡ Lambda Function URL: $lambda_url"
fi

# Show summary
if [[ -z "$api_url" && -z "$lambda_url" ]]; then
  echo "❌ No infrastructure URLs found for stage: $STAGE"
  exit 1
fi
