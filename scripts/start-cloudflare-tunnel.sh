#!/usr/bin/env bash
# Run Cloudflare Tunnel connector for CodeNomad public hostnames.
# Prefers local CLOUDFLARE_TUNNEL_TOKEN, else delegates to Prestix script.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PRESTIX_SCRIPT="${PRESTIX_CODENOMAD_TUNNEL_SCRIPT:-/Users/iliashapiro/prestix/prestixvip/scripts/start-cloudflare-tunnel.sh}"
MODE="${1:-}"
LOG="${ROOT}/logs/cloudflared-tunnel.log"
mkdir -p "${ROOT}/logs"

load_env() {
  if [[ -f "${ROOT}/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "${ROOT}/.env"
    set +a
  fi
  if [[ -f "${ROOT}/.env.local" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "${ROOT}/.env.local"
    set +a
  fi
}

load_env
export TUNNEL_TRANSPORT_PROTOCOL="${TUNNEL_TRANSPORT_PROTOCOL:-http2}"
TOKEN="${CLOUDFLARE_TUNNEL_TOKEN:-${TUNNEL_TOKEN:-}}"

if [[ "$MODE" == "--daemon" ]]; then
  if pgrep -f 'cloudflared tunnel' >/dev/null 2>&1; then
    echo "cloudflared already running"
    pgrep -fl 'cloudflared tunnel' | sed 's/eyJ[^ ]*/[TOKEN_REDACTED]/g' || true
    exit 0
  fi
  nohup "$0" >>"$LOG" 2>&1 &
  sleep 4
  if pgrep -f 'cloudflared tunnel' >/dev/null 2>&1; then
    echo "Started cloudflared (log: ${LOG})"
    pgrep -fl 'cloudflared tunnel' | sed 's/eyJ[^ ]*/[TOKEN_REDACTED]/g' || true
  else
    echo "ERROR: cloudflared failed to start — see ${LOG}" >&2
    tail -20 "$LOG" 2>/dev/null || true
    exit 1
  fi
  exit 0
fi

if [[ -n "$TOKEN" ]]; then
  echo "Starting cloudflared with CLOUDFLARE_TUNNEL_TOKEN (remote-managed ingress)"
  echo "  Expected hostnames: nomad.prestix.vip, codenomad.prestix.vip"
  exec cloudflared tunnel --retries 10 --grace-period 30s run --protocol http2 --token "$TOKEN"
fi

if [[ -f "$PRESTIX_SCRIPT" ]]; then
  echo "No local CLOUDFLARE_TUNNEL_TOKEN — delegating to Prestix script"
  exec bash "$PRESTIX_SCRIPT" "$@"
fi

echo "ERROR: set CLOUDFLARE_TUNNEL_TOKEN in ${ROOT}/.env (gitignored)" >&2
echo "  or ensure Prestix script exists: ${PRESTIX_SCRIPT}" >&2
exit 1
