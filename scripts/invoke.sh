#!/bin/bash

# Invoke deployed infrastructure endpoints
# Usage: ./invoke.sh --stage=dev --type=lambda
#        ./invoke.sh --stage=prod --type=ecs

set -e

# Default values
STAGE="dev"
TYPE=""
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
    *)
      echo "❌ Unknown argument: $arg"
      echo "   Usage: $0 --stage=dev --type=lambda|ecs"
      exit 1
      ;;
  esac
done

# Validate required parameters
if [[ -z "$TYPE" ]]; then
  echo "❌ Error: --type parameter is required"
  echo "   Usage: $0 --stage=$STAGE --type=lambda|ecs"
  exit 1
fi

if [[ "$TYPE" != "lambda" && "$TYPE" != "ecs" ]]; then
  echo "❌ Error: --type must be either 'lambda' or 'ecs'"
  echo "   Usage: $0 --stage=$STAGE --type=lambda|ecs"
  exit 1
fi

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
  url=$(jq -r '.lambdaFunctionUrl // empty' "$OUTPUT_FILE" 2>/dev/null)
  if [[ -z "$url" || "$url" == "null" ]]; then
    echo "❌ No Lambda Function URL found in $OUTPUT_FILE"
    exit 1
  fi
  echo "⚡ Invoking Lambda Function: $url"
elif [[ "$TYPE" == "ecs" ]]; then
  url="$(jq -r '.apiGatewayUrl // empty' "$OUTPUT_FILE" 2>/dev/null)/lambda"
  if [[ -z "$url" || "$url" == "null" ]]; then
    echo "❌ No Load Balancer URL found in $OUTPUT_FILE"
    exit 1
  fi
  echo "🔗 Invoking ECS Load Balancer: $url"
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