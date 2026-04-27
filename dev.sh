#!/usr/bin/env bash
# Local development helper for the Caava PMT monorepo (bash version).
# Mirror of dev.ps1; use whichever is comfortable on your machine.
#
# Usage:
#   ./dev.sh setup              Create .env files and generate secret keys
#   ./dev.sh up                 Start infra + API + workers (Docker)
#   ./dev.sh web                Run the web frontend on the host (Vite)
#   ./dev.sh logs [service]     Tail logs
#   ./dev.sh ps                 List service status
#   ./dev.sh restart [service]  Restart a service (default: api)
#   ./dev.sh migrate            Re-run database migrations
#   ./dev.sh seed-widgets       Seed the default dashboard widget catalog
#   ./dev.sh shell [service]    Django shell (default: api)
#   ./dev.sh down               Stop all services
#   ./dev.sh nuke               Stop and wipe volumes (fresh DB)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose-local.yml"
COMPOSE=(docker compose -f "$COMPOSE_FILE")

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; NC='\033[0m'
info() { printf "${CYAN}==> %s${NC}\n" "$*"; }
ok()   { printf "${GREEN}[ok] %s${NC}\n" "$*"; }
warn() { printf "${YELLOW}[warn] %s${NC}\n" "$*"; }
err()  { printf "${RED}[error] %s${NC}\n" "$*"; }

require_tool() {
  command -v "$1" >/dev/null 2>&1 || { err "$1 is not on PATH"; exit 1; }
}

random_key() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 25
  else
    LC_ALL=C tr -dc 'a-z0-9' < /dev/urandom | head -c50
  fi
}

set_env_key() {
  local file="$1" key="$2" value="$3"
  local tmp
  tmp="$(mktemp)"
  if [[ -f "$file" ]] && grep -qE "^[[:space:]]*${key}[[:space:]]*=" "$file"; then
    awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} {
      if ($1 ~ "^[[:space:]]*"k"[[:space:]]*$") { print k"="v } else { print }
    }' "$file" > "$tmp"
  else
    [[ -f "$file" ]] && cat "$file" > "$tmp" || true
    printf "%s=%s\n" "$key" "$value" >> "$tmp"
  fi
  mv "$tmp" "$file"
}

ensure_env_file() {
  local target="$1" template="$2"
  if [[ ! -f "$target" ]]; then
    if [[ ! -f "$template" ]]; then warn "Template missing: $template"; return 1; fi
    cp "$template" "$target"
    ok "Created $target from $template"
  else
    info "$target already exists, leaving it."
  fi
}

cmd_setup() {
  require_tool docker
  ensure_env_file "$REPO_ROOT/.env"          "$REPO_ROOT/.env.example"          || true
  ensure_env_file "$REPO_ROOT/apps/api/.env" "$REPO_ROOT/apps/api/.env.example" || true
  ensure_env_file "$REPO_ROOT/apps/web/.env" "$REPO_ROOT/apps/web/.env.example" || true

  info "Normalizing credentials between root .env and apps/api/.env..."
  local pairs=(
    "POSTGRES_USER=plane"
    "POSTGRES_PASSWORD=plane"
    "POSTGRES_DB=plane"
    "RABBITMQ_USER=plane"
    "RABBITMQ_PASSWORD=plane"
    "RABBITMQ_VHOST=plane"
    "AWS_ACCESS_KEY_ID=access-key"
    "AWS_SECRET_ACCESS_KEY=secret-key"
    "AWS_S3_BUCKET_NAME=uploads"
  )
  for pair in "${pairs[@]}"; do
    local k="${pair%%=*}" v="${pair#*=}"
    set_env_key "$REPO_ROOT/.env" "$k" "$v"
    set_env_key "$REPO_ROOT/apps/api/.env" "$k" "$v"
  done

  if ! grep -qE "^[[:space:]]*SECRET_KEY[[:space:]]*=[[:space:]]*\S" "$REPO_ROOT/apps/api/.env"; then
    set_env_key "$REPO_ROOT/apps/api/.env" "SECRET_KEY" "$(random_key)"
    ok "Generated SECRET_KEY"
  fi
  if ! grep -qE "^[[:space:]]*LIVE_SERVER_SECRET_KEY[[:space:]]*=[[:space:]]*\S" "$REPO_ROOT/apps/api/.env"; then
    set_env_key "$REPO_ROOT/apps/api/.env" "LIVE_SERVER_SECRET_KEY" "$(random_key)"
    ok "Generated LIVE_SERVER_SECRET_KEY"
  fi

  set_env_key "$REPO_ROOT/apps/api/.env" "WEB_URL" "http://localhost:3000"
  set_env_key "$REPO_ROOT/apps/api/.env" "APP_BASE_URL" "http://localhost:3000"

  ok "Setup complete. Next: ./dev.sh up"
}

cmd_up() {
  require_tool docker
  [[ -f "$REPO_ROOT/apps/api/.env" ]] || { err "apps/api/.env missing. Run: ./dev.sh setup"; exit 1; }

  info "Starting infra (postgres / redis / rabbitmq / minio)..."
  "${COMPOSE[@]}" up -d plane-db plane-redis plane-mq plane-minio

  info "Running migrations (one-shot)..."
  "${COMPOSE[@]}" run --rm migrator

  info "Starting API + workers (source is volume-mounted, hot reload enabled)..."
  "${COMPOSE[@]}" up -d api worker beat-worker

  echo
  ok "Backend is up:"
  echo "  - API:       http://localhost:8000"
  echo "  - MinIO:     http://localhost:9090  (console)"
  echo "  - Postgres:  localhost:5432"
  echo
  echo "Now run the web frontend on the host:"
  printf "${YELLOW}  ./dev.sh web${NC}\n"
}

cmd_down()    { require_tool docker; info "Stopping..."; "${COMPOSE[@]}" down; }
cmd_restart() { require_tool docker; local svc="${1:-api}"; info "Restarting $svc"; "${COMPOSE[@]}" restart "$svc"; }
cmd_logs()    { require_tool docker; "${COMPOSE[@]}" logs -f --tail=200 "$@"; }
cmd_ps()      { require_tool docker; "${COMPOSE[@]}" ps; }
cmd_migrate() { require_tool docker; info "Running migrations..."; "${COMPOSE[@]}" run --rm migrator; }
cmd_seed_widgets() { require_tool docker; info "Seeding widgets..."; "${COMPOSE[@]}" exec api python manage.py seed_widgets; }
cmd_shell()   { require_tool docker; local svc="${1:-api}"; info "Django shell in $svc"; "${COMPOSE[@]}" exec "$svc" python manage.py shell; }

cmd_web() {
  require_tool node
  require_tool npm
  if ! command -v pnpm >/dev/null 2>&1; then
    info "pnpm not found, installing globally..."
    npm install -g pnpm@10
  fi
  cd "$REPO_ROOT"
  if [[ ! -d node_modules ]]; then
    info "Installing workspace dependencies (first time only)..."
    pnpm install
  fi
  info "Starting Vite dev server (http://localhost:3000)..."
  pnpm dev
}

cmd_nuke() {
  require_tool docker
  warn "This will DELETE local Postgres / MinIO / Redis / RabbitMQ data."
  read -r -p "Type 'yes' to confirm: " reply
  [[ "$reply" == "yes" ]] || { info "Cancelled."; return; }
  "${COMPOSE[@]}" down -v
  ok "Volumes wiped."
}

cmd_help() {
  cat <<'USAGE'
Caava PMT — local dev helper

Usage:
  ./dev.sh setup              Create .env files and generate secret keys
  ./dev.sh up                 Start infra + API + workers (Docker)
  ./dev.sh web                Run the web frontend on the host (Vite)
  ./dev.sh logs [service]     Tail logs (default: all)
  ./dev.sh ps                 List service status
  ./dev.sh restart [service]  Restart a service (default: api)
  ./dev.sh migrate            Re-run database migrations
  ./dev.sh seed-widgets       Seed the default dashboard widget catalog
  ./dev.sh shell [service]    Django shell (default: api)
  ./dev.sh down               Stop all services
  ./dev.sh nuke               Stop and wipe volumes (fresh DB)

Recommended workflow:
  1. Terminal A:  ./dev.sh setup    (only the first time)
  2. Terminal A:  ./dev.sh up
  3. Terminal B:  ./dev.sh web
USAGE
}

cmd="${1:-help}"
shift || true
case "$cmd" in
  setup)        cmd_setup        "$@" ;;
  up)           cmd_up           "$@" ;;
  down)         cmd_down         "$@" ;;
  restart)      cmd_restart      "$@" ;;
  logs)         cmd_logs         "$@" ;;
  ps)           cmd_ps           "$@" ;;
  migrate)      cmd_migrate      "$@" ;;
  seed-widgets) cmd_seed_widgets "$@" ;;
  shell)        cmd_shell        "$@" ;;
  web)          cmd_web          "$@" ;;
  nuke)         cmd_nuke         "$@" ;;
  help|*)       cmd_help              ;;
esac
