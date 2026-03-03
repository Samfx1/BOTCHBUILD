#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.preview-logs"

BACKEND_PID=""
WORKER_PID=""
FRONTEND_PID=""

info() {
  echo "[preview] $1"
}

warn() {
  echo "[preview][warn] $1"
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "[preview][error] Required command not found: $command_name"
    exit 1
  fi
}

wait_for_http() {
  local name="$1"
  local url="$2"
  local attempts="${3:-60}"

  for ((i = 1; i <= attempts; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      info "$name is reachable at $url"
      return 0
    fi
    sleep 1
  done

  warn "$name did not become reachable within ${attempts}s ($url)"
  return 1
}

cleanup() {
  info "Shutting down preview processes..."
  if [[ -n "$FRONTEND_PID" ]]; then
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$WORKER_PID" ]]; then
    kill "$WORKER_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$BACKEND_PID" ]]; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

require_command "node"
require_command "npm"
require_command "curl"

mkdir -p "$LOG_DIR"

if [[ ! -f "$ROOT_DIR/backend/.env" ]]; then
  info "backend/.env not found. Creating from backend/.env.example"
  cp "$ROOT_DIR/backend/.env.example" "$ROOT_DIR/backend/.env"
fi

if [[ ! -f "$ROOT_DIR/frontend/.env.local" ]]; then
  info "frontend/.env.local not found. Creating from frontend/.env.example"
  cp "$ROOT_DIR/frontend/.env.example" "$ROOT_DIR/frontend/.env.local"
fi

info "Installing backend dependencies..."
npm ci --prefix "$ROOT_DIR/backend"

info "Installing frontend dependencies..."
npm ci --prefix "$ROOT_DIR/frontend"

info "Running database migrations..."
npm run migrate --prefix "$ROOT_DIR/backend"

info "Starting backend API..."
npm run dev --prefix "$ROOT_DIR/backend" >"$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID="$!"

info "Starting background worker..."
npm run worker --prefix "$ROOT_DIR/backend" >"$LOG_DIR/worker.log" 2>&1 &
WORKER_PID="$!"

info "Starting frontend dev server..."
npm run dev --prefix "$ROOT_DIR/frontend" >"$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID="$!"

wait_for_http "Backend health" "http://localhost:4000/api/v1/health" 90 || true
wait_for_http "Frontend" "http://localhost:3000" 90 || true

cat <<EOF

[preview] Live preview is running.
[preview] Frontend: http://localhost:3000
[preview] Backend health: http://localhost:4000/api/v1/health
[preview] Backend readiness: http://localhost:4000/api/v1/health/readiness
[preview] Logs:
  - $LOG_DIR/backend.log
  - $LOG_DIR/worker.log
  - $LOG_DIR/frontend.log

Press Ctrl+C to stop all preview processes.
EOF

while true; do
  if [[ -n "$BACKEND_PID" ]] && ! kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    warn "Backend process exited unexpectedly. See $LOG_DIR/backend.log"
    exit 1
  fi

  if [[ -n "$WORKER_PID" ]] && ! kill -0 "$WORKER_PID" >/dev/null 2>&1; then
    warn "Worker process exited unexpectedly. See $LOG_DIR/worker.log"
    exit 1
  fi

  if [[ -n "$FRONTEND_PID" ]] && ! kill -0 "$FRONTEND_PID" >/dev/null 2>&1; then
    warn "Frontend process exited unexpectedly. See $LOG_DIR/frontend.log"
    exit 1
  fi

  sleep 2
done
