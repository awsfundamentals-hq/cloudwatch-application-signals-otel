#!/bin/bash

# Invoke deployed infrastructure endpoints
# Usage: ./invoke.sh --stage=dev --type=lambda
#        ./invoke.sh --stage=prod --type=ecs
#        ./invoke.sh --stage=dev --type=ecs --path=/health
#        ./invoke.sh --stage=dev --type=ecs --path=lambda

set -e

# Default values
STAGE="dev"
TYPE=""
REQUEST_PATH=""
OUTPUT_FILE="output.json"

# Parse command line arguments
for arg in "$@"; do
  case $arg in
    --stage=*)
      STAGE="${arg#*=}"
      shift
      ;;
    --type=*)
      TYPE="${arg#*=}"
      shift
      ;;
    --path=*)
      REQUEST_PATH="${arg#*=}"
      shift
      ;;
    *)
      echo "❌ Unknown argument: $arg"
      echo "   Usage: $0 --stage=dev --type=lambda|ecs [--path=/endpoint]"
      exit 1
      ;;
  esac
done

# Validate required parameters
if [[ -z "$TYPE" ]]; then
  echo "❌ Error: --type parameter is required"
  echo "   Usage: $0 --stage=$STAGE --type=lambda|ecs [--path=/endpoint]"
  exit 1
fi

if [[ "$TYPE" != "lambda" && "$TYPE" != "ecs" ]]; then
  echo "❌ Error: --type must be either 'lambda' or 'ecs'"
  echo "   Usage: $0 --stage=$STAGE --type=lambda|ecs [--path=/endpoint]"
  exit 1
fi

# Function to append path to URL while avoiding double slashes
append_path() {
  local base_url="$1"
  local request_path="$2"
  
  if [[ -z "$request_path" ]]; then
    echo "$base_url"
    return
  fi
  
  # Remove trailing slash from base URL if it exists
  base_url="${base_url%/}"
  
  # Add leading slash to path if it doesn't exist
  if [[ "$request_path" != /* ]]; then
    request_path="/$request_path"
  fi
  
  echo "${base_url}${request_path}"
}

# Check if output.json exists, if not generate it
if [[ ! -f "$OUTPUT_FILE" ]]; then
  echo "📄 output.json not found, generating URLs for stage: $STAGE"
  if ! pnpm run extract-urls:$STAGE; then
    echo "❌ Failed to extract URLs for stage: $STAGE"
    exit 1
  fi
  echo "✅ URLs extracted successfully"
fi

# Extract the appropriate URL based on type
if [[ "$TYPE" == "lambda" ]]; then
  base_url=$(jq -r '.lambdaFunctionUrl // empty' "$OUTPUT_FILE" 2>/dev/null)
  if [[ -z "$base_url" || "$base_url" == "null" ]]; then
    echo "❌ No Lambda Function URL found in $OUTPUT_FILE"
    exit 1
  fi
  url=$(append_path "$base_url" "$REQUEST_PATH")
  echo "⚡ Invoking Lambda Function: $url"
elif [[ "$TYPE" == "ecs" ]]; then
  base_url=$(jq -r '.apiGatewayUrl // empty' "$OUTPUT_FILE" 2>/dev/null)
  if [[ -z "$base_url" || "$base_url" == "null" ]]; then
    echo "❌ No API GW URL found in $OUTPUT_FILE"
    exit 1
  fi
  url=$(append_path "$base_url" "$REQUEST_PATH")
  echo "🔗 Invoking ECS API GW: $url"
fi

# Perform the cURL request
echo "🚀 Making HTTP request..."
echo "---"

echo "📊 Response Headers:"
echo "----------------"
if ! curl -f -s -D - -o /dev/null "$url" | grep -v "^$" && \
   echo "----------------" && \
   echo -e "\n📈 Metrics:" && \
   curl -f -s -o /dev/null -w "\nHTTP Status: %{http_code}\nResponse Time: %{time_total}s\nTotal Size: %{size_download} bytes\n" "$url"; then
  echo ""
  echo "❌ Request failed"
  exit 1
fi

echo ""
echo "✅ Request completed successfully"