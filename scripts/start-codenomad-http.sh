#!/usr/bin/env bash
# Start CodeNomad HTTP on 127.0.0.1:9899 for Cloudflare tunnel (RedRuby-FPA workspace).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${CLI_HTTP_PORT:-9899}"
HOST="${CLI_HOST:-127.0.0.1}"
HEALTH_URL="http://${HOST}:${PORT}/api/auth/status"
PASSWORD="${CODENOMAD_SERVER_PASSWORD:-454212}"

ensure_path() {
  local extra=()
  [[ -n "${HOME:-}" ]] && extra+=("${HOME}/.npm-global/bin" "${HOME}/.local/bin" "${HOME}/.bun/bin")
  extra+=("/opt/homebrew/bin" "/usr/local/bin")
  export PATH="$(IFS=:; echo "${extra[*]}:${PATH}")"
}
ensure_path

if [[ -f "${ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +a
fi

port_pids() {
  lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true
}

free_port() {
  local pids pid
  pids="$(port_pids)"
  [[ -z "$pids" ]] && return 0
  echo "Stopping listener(s) on :${PORT}..."
  while IFS= read -r pid; do
    [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true
  done <<< "$pids"
  sleep 2
  pids="$(port_pids)"
  if [[ -n "$pids" ]]; then
    while IFS= read -r pid; do
      [[ -n "$pid" ]] && kill -9 "$pid" 2>/dev/null || true
    done <<< "$pids"
    sleep 1
  fi
}

existing="$(port_pids | head -1)"
if [[ "${1:-}" == "--restart" ]]; then
  free_port
elif [[ -n "$existing" ]]; then
  if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
    echo "CodeNomad already running on http://${HOST}:${PORT} (PID ${existing})"
    echo "  Public: https://nomad.prestix.vip  (also https://codenomad.prestix.vip)"
    echo "  Use: bash scripts/start-codenomad-http.sh --restart  to replace it"
    exit 0
  fi
  echo "ERROR: Port ${PORT} in use by PID ${existing} but health check failed."
  echo "  Free: kill ${existing}   or   bash scripts/start-codenomad-http.sh --restart"
  exit 1
fi

echo "=== CodeNomad (RedRuby-FPA) ==="
echo "  Local:     http://${HOST}:${PORT}"
echo "  Public:    https://nomad.prestix.vip"
echo "  Alias:     https://codenomad.prestix.vip"
echo "  Workspace: ${ROOT}"
echo ""

# Prefer globally installed package (matches prior npx usage).
if command -v codenomad >/dev/null 2>&1 || command -v npx >/dev/null 2>&1; then
  exec npx --yes @neuralnomads/codenomad \
    --password "$PASSWORD" \
    --https=false \
    --http=true \
    --http-port "$PORT" \
    --host "$HOST"
fi

echo "ERROR: npx required to start CodeNomad" >&2
exit 127
