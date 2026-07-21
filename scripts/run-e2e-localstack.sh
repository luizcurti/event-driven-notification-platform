#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.localstack.yml}"
PROFILE="${LOCALSTACK_PROFILE:-e2e-localstack}"
ENDPOINT="${LOCALSTACK_ENDPOINT:-http://localhost:4566}"
HEALTH_URL="${ENDPOINT}/_localstack/health"

started_localstack="false"

cleanup() {
  if [[ "$started_localstack" == "true" ]]; then
    docker compose -f "$COMPOSE_FILE" --profile "$PROFILE" down --remove-orphans
  fi
}

trap cleanup EXIT

echo "Checking LocalStack at $HEALTH_URL"
if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
  echo "LocalStack is already running. Reusing existing instance."
else
  echo "Starting LocalStack via Docker Compose (profile: $PROFILE)"
  docker compose -f "$COMPOSE_FILE" --profile "$PROFILE" up -d
  started_localstack="true"

  echo "Waiting for LocalStack healthcheck"
  curl -fsS "$HEALTH_URL" --retry 60 --retry-delay 2 --retry-all-errors --retry-connrefused >/dev/null
fi

echo "Running E2E tests"
npm run test:e2e
