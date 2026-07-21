#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.localstack.yml}"
PROFILE="${LOCALSTACK_PROFILE:-e2e-localstack}"
ENDPOINT="${LOCALSTACK_ENDPOINT:-http://localhost:4566}"

echo "Destroying Terraform (LocalStack mode)"
(
  cd terraform
  terraform destroy -auto-approve -input=false \
    -var="use_localstack=true" \
    -var="localstack_endpoint=${ENDPOINT}" \
    -var="api_key_value=local-dev-key-1234567890" || true
)

echo "Stopping LocalStack"
docker compose -f "$COMPOSE_FILE" --profile "$PROFILE" down --remove-orphans

echo "Local environment destroyed"
