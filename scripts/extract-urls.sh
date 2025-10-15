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

# Function to get Load Balancer URL
get_load_balancer_url() {
  local stage=$1
  local resource_prefix="${APP_NAME}-${stage}"
  
  echo "🔍 Searching for Load Balancer in stage: $stage" >&2
  
  local lb_dns
  lb_dns=$(aws elbv2 describe-load-balancers \
    --query "LoadBalancers[?starts_with(LoadBalancerName, '${resource_prefix}')].DNSName" \
    --output text 2>/dev/null || echo "None")
  
  if [[ -n "$lb_dns" && "$lb_dns" != "None" && "$lb_dns" != "" ]]; then
    echo "✅ Found Load Balancer: http://$lb_dns" >&2
    echo "http://$lb_dns"
  else
    echo "⚠️  No Load Balancer found for stage: $stage" >&2
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
    --arg lb_url "$lb_url" \
    --arg lambda_url "$lambda_url" \
    --arg timestamp "$timestamp" \
    '{
      "loadBalancerUrl": (if $lb_url == "" then null else $lb_url end),
      "lambdaFunctionUrl": (if $lambda_url == "" then null else $lambda_url end),
      "extractedAt": $timestamp
    }' > "$temp_file" && mv "$temp_file" "$OUTPUT_FILE"
}

# Main execution
echo "🚀 Extracting infrastructure URLs for stage: $STAGE"

# Extract Load Balancer URL
lb_url=""
if url=$(get_load_balancer_url "$STAGE"); then
  lb_url="$url"
fi

# Extract Lambda Function URL  
lambda_url=""
if url=$(get_lambda_function_url "$STAGE"); then
  lambda_url="$url"
fi

# Create the output file
create_output_json "$lb_url" "$lambda_url"

echo "✅ URLs extracted successfully!"
echo "📁 Written to: $OUTPUT_FILE"

if [[ -n "$lb_url" ]]; then
  echo "🔗 Load Balancer URL: $lb_url"
fi

if [[ -n "$lambda_url" ]]; then
  echo "⚡ Lambda Function URL: $lambda_url"
fi

# Show summary
if [[ -z "$lb_url" && -z "$lambda_url" ]]; then
  echo "❌ No infrastructure URLs found for stage: $STAGE"
  exit 1
fi
