#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.localstack.yml}"
PROFILE="${LOCALSTACK_PROFILE:-e2e-localstack}"
ENDPOINT="${LOCALSTACK_ENDPOINT:-http://localhost:4566}"
HEALTH_URL="${ENDPOINT}/_localstack/health"
API_KEY_VALUE="${API_KEY_VALUE:-local-dev-key-1234567890}"
LOCALSTACK_HOST_PORT="${LOCALSTACK_HOST_PORT:-}"
POSTMAN_ENV_FILE="${POSTMAN_ENV_FILE:-postman/localstack.postman_environment.json}"

if [[ -z "$LOCALSTACK_HOST_PORT" ]]; then
  LOCALSTACK_HOST_PORT="$(echo "$ENDPOINT" | sed -nE 's#^https?://[^:]+:([0-9]+).*$#\1#p')"
fi

LOCALSTACK_HOST_PORT="${LOCALSTACK_HOST_PORT:-4566}"
export LOCALSTACK_HOST_PORT

require_service() {
  local health_json="$1"
  local service_name="$2"

  if ! echo "$health_json" | grep -Eq "\"$service_name\"[[:space:]]*:[[:space:]]*\"(running|available)\""; then
    echo "Service '$service_name' is not active in the current LocalStack instance." >&2
    echo "Set LOCALSTACK_ENDPOINT/LOCALSTACK_HOST_PORT to a dedicated instance or start LocalStack with this project's docker compose file." >&2
    exit 1
  fi
}

wait_required_services() {
  local retries=40
  local delay_seconds=2
  local health_json=""

  while (( retries > 0 )); do
    health_json="$(curl -fsS "$HEALTH_URL" || true)"

    if echo "$health_json" | grep -Eq '"dynamodb"[[:space:]]*:[[:space:]]*"(running|available)"' &&
      echo "$health_json" | grep -Eq '"events"[[:space:]]*:[[:space:]]*"(running|available)"' &&
      echo "$health_json" | grep -Eq '"sqs"[[:space:]]*:[[:space:]]*"(running|available)"' &&
      echo "$health_json" | grep -Eq '"lambda"[[:space:]]*:[[:space:]]*"(running|available)"' &&
      echo "$health_json" | grep -Eq '"apigateway"[[:space:]]*:[[:space:]]*"(running|available)"'; then
      echo "$health_json"
      return
    fi

    retries=$((retries - 1))
    sleep "$delay_seconds"
  done

  echo "$health_json"
}

ensure_localstack() {
  echo "Checking LocalStack at $HEALTH_URL"
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo "LocalStack is already running."
  else
    echo "Starting LocalStack via Docker Compose (profile: $PROFILE)"
    docker compose -f "$COMPOSE_FILE" --profile "$PROFILE" up -d

    echo "Waiting for LocalStack healthcheck"
    curl -fsS "$HEALTH_URL" --retry 60 --retry-delay 2 --retry-all-errors --retry-connrefused >/dev/null
  fi

  local health_json
  health_json="$(wait_required_services)"
  require_service "$health_json" "dynamodb"
  require_service "$health_json" "events"
  require_service "$health_json" "sqs"
  require_service "$health_json" "lambda"
  require_service "$health_json" "apigateway"
}

package_lambdas() {
  echo "Building application"
  npm run build >/dev/null

  echo "Packaging Lambdas into dist/lambdas.zip"
  rm -f dist/lambdas.zip
  (
    cd dist
    zip -rq lambdas.zip .
  )
}

apply_terraform() {
  echo "Applying Terraform in LocalStack mode"
  (
    cd terraform
    terraform init -input=false >/dev/null
    terraform apply -auto-approve -input=false \
      -var="use_localstack=true" \
      -var="localstack_endpoint=${ENDPOINT}" \
      -var="api_key_value=${API_KEY_VALUE}"
  )
}

write_postman_environment() {
  local api_url="$1"

  if [[ -z "$api_url" ]]; then
    echo "Skipping Postman environment generation because api_url is empty." >&2
    return
  fi

  local postman_api_url=""
  if [[ "$api_url" =~ ^https?://([^.]+)\.execute-api\.[^/]+/prod$ ]]; then
    postman_api_url="http://${BASH_REMATCH[1]}.execute-api.localhost.localstack.cloud:${LOCALSTACK_HOST_PORT}/prod"
  else
    postman_api_url="$api_url"
  fi

  mkdir -p "$(dirname "$POSTMAN_ENV_FILE")"

  cat > "$POSTMAN_ENV_FILE" <<EOF
{
  "id": "b1e8f0bb-3c77-4c68-9f6b-9d8d5e2a2f9a",
  "name": "Event-Driven Notification Platform - LocalStack",
  "values": [
    {
      "key": "apiUrl",
      "value": "$postman_api_url",
      "type": "default",
      "enabled": true
    },
    {
      "key": "apiKey",
      "value": "$API_KEY_VALUE",
      "type": "default",
      "enabled": true
    }
  ],
  "_postman_variable_scope": "environment",
  "_postman_exported_at": "2026-07-20T00:00:00.000Z",
  "_postman_exported_using": "Copilot"
}
EOF

  echo "Postman environment written to $POSTMAN_ENV_FILE"
}

show_outputs() {
  echo "Local infrastructure is ready. Terraform outputs:"
  (
    cd terraform
    terraform output
  )

  local api_url
  api_url="$(cd terraform && terraform output -raw api_url 2>/dev/null || true)"

  echo "Quick test suggestion (Postman or curl):"
  if [[ -n "$api_url" ]]; then
    echo "  URL base: $api_url"
    echo "  Header: x-api-key: $API_KEY_VALUE"
    echo "  Exemplo:"
    cat <<EOF
    curl -X POST "$api_url/notifications" \
      -H "Content-Type: application/json" \
      -H "x-api-key: $API_KEY_VALUE" \
      -d '{"eventType":"OrderApproved","recipient":"user@example.com","channels":["EMAIL"],"payload":{"orderId":"12345"}}'
EOF
  fi
  echo "Postman collection: postman/event-driven-notification-platform.postman_collection.json"
}

ensure_localstack
package_lambdas
apply_terraform
api_url="$(cd terraform && terraform output -raw api_url 2>/dev/null || true)"
write_postman_environment "$api_url"
show_outputs
