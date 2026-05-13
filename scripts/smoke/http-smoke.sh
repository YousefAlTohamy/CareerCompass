#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost}"
API_URL="${BASE_URL%/}/api"

echo "Checking Laravel API health at ${API_URL}/health"
curl -fsS --retry 10 --retry-delay 3 --retry-connrefused "${API_URL}/health" >/tmp/cc-api-health.json

echo "Checking API v1 health at ${API_URL}/v1/health"
curl -fsS --retry 10 --retry-delay 3 --retry-connrefused "${API_URL}/v1/health" >/tmp/cc-api-v1-health.json

echo "Checking nginx root at ${BASE_URL}"
curl -fsS --retry 5 --retry-delay 2 --retry-connrefused "${BASE_URL}" >/tmp/cc-root.html

echo "HTTP smoke test passed"
