#!/usr/bin/env bash
# Register CodeNomad SideCars for the RedRuby-FPA / tokenizmyapp workspace.
#
# SideCars are fixed local ports that CodeNomad proxies into UI tabs at
#   /sidecars/<id>/
# Config lives under server.sidecars in ~/.config/codenomad/config.yaml
# (or is created live via POST /api/sidecars when CodeNomad is running).
#
# Usage:
#   bash scripts/generate-recommended-sidecars.sh
#   bash scripts/generate-recommended-sidecars.sh --dry-run
#   bash scripts/generate-recommended-sidecars.sh --tier required
#   bash scripts/generate-recommended-sidecars.sh --tier recommended
#   bash scripts/generate-recommended-sidecars.sh --tier all
#   bash scripts/generate-recommended-sidecars.sh --yaml-only
#   bash scripts/generate-recommended-sidecars.sh --print-start
#
# Env:
#   CODENOMAD_URL              default http://127.0.0.1:9899
#   CODENOMAD_USERNAME         default codenomad
#   CODENOMAD_SERVER_PASSWORD  default from .env / 454212
#   CODENOMAD_CONFIG_YAML      default ~/.config/codenomad/config.yaml
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CODENOMAD_URL="${CODENOMAD_URL:-http://127.0.0.1:9899}"
CODENOMAD_USERNAME="${CODENOMAD_USERNAME:-codenomad}"
CODENOMAD_CONFIG_YAML="${CODENOMAD_CONFIG_YAML:-${HOME}/.config/codenomad/config.yaml}"
COOKIE_JAR="$(mktemp -t codenomad-sidecars.XXXXXX)"
trap 'rm -f "$COOKIE_JAR"' EXIT

if [[ -f "${ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +a
fi
PASSWORD="${CODENOMAD_SERVER_PASSWORD:-454212}"

TIER="recommended"   # required | recommended | all
DRY_RUN=0
YAML_ONLY=0
PRINT_START=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tier) TIER="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --yaml-only) YAML_ONLY=1; shift ;;
    --print-start) PRINT_START=1; shift ;;
    -h|--help)
      sed -n '2,25p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

case "$TIER" in
  required|recommended|all) ;;
  *)
    echo "Invalid --tier '$TIER' (use required|recommended|all)" >&2
    exit 2
    ;;
esac

# ── Catalog ──────────────────────────────────────────────────────
# Fields: id|name|port|insecure(true=HTTP)|prefixMode|tier|start_hint
#
# insecure=true  → Protocol HTTP  (almost all local tools)
# insecure=false → Protocol HTTPS (rare for localhost)
# prefixMode=strip → SideCar sees paths without /sidecars/<id> (Next, Prisma, Inngest)
#
# ★ Insight: CodeNomad only probes TCP listen on 127.0.0.1:<port>.
#   Status "running" means the process is up — registration alone does not start it.

REQUIRED_ROWS=(
  "tokenizmyapp-dev|TokenizMyApp Dev|3000|true|strip|required|cd tokenizmyapp && bun run dev"
  "prisma-studio|Prisma Studio|5555|true|strip|required|cd tokenizmyapp && bunx prisma studio --port 5555 --browser none"
)

RECOMMENDED_ROWS=(
  "inngest-dev|Inngest Dev|8288|true|strip|recommended|cd tokenizmyapp && bunx inngest-cli@latest dev -u http://127.0.0.1:3000/api/inngest"
  "pgweb|pgweb (Neon)|8081|true|strip|recommended|pgweb --bind=127.0.0.1 --listen=8081 --url \"\$POSTGRES_URL\""
)

# ── YOUR CONTRIBUTION (optional tier) ────────────────────────────
# Decide which occasional tooling tabs belong in CodeNomad for this workspace.
# Add 1–3 rows below using the same pipe-delimited shape as REQUIRED_ROWS.
# Leave empty to skip optional registration.
#
# Trade-offs to weigh:
#   - Vitest UI / Playwright report are great while testing, noisy as always-on tabs
#   - Raw Ollama (:11434) is an API, not a browser UI — prefer Open WebUI if you want a tab
#   - Bundle analyzer is ephemeral; usually better as a one-off, not a SideCar
#
# TODO: append optional SideCar definitions here (5–10 lines).
# Example (uncomment / adapt):
# OPTIONAL_ROWS=(
#   "vitest-ui|Vitest UI|51204|true|strip|optional|cd tokenizmyapp && bunx vitest --ui --api 51204"
#   "playwright-report|Playwright Report|9323|true|strip|optional|cd tokenizmyapp && bunx playwright show-report --port 9323 --host 127.0.0.1"
# )
OPTIONAL_ROWS=(
  # ← fill me
)

selected_rows() {
  local row tier
  for row in "${REQUIRED_ROWS[@]}"; do
    echo "$row"
  done
  if [[ "$TIER" == "recommended" || "$TIER" == "all" ]]; then
    for row in "${RECOMMENDED_ROWS[@]}"; do
      echo "$row"
    done
  fi
  if [[ "$TIER" == "all" ]]; then
    for row in "${OPTIONAL_ROWS[@]}"; do
      [[ -z "${row//[[:space:]]/}" || "$row" == \#* ]] && continue
      echo "$row"
    done
  fi
}

derive_id() {
  # Mirror CodeNomad SideCarManager.buildSideCarId / UI deriveSidecarId
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/-+/-/g; s/^-|-$//g'
}

print_catalog() {
  printf '%-22s %-22s %-6s %-6s %-8s %s\n' "ID" "NAME" "PORT" "PROTO" "PREFIX" "START"
  printf '%-22s %-22s %-6s %-6s %-8s %s\n' "----------------------" "----------------------" "------" "------" "--------" "-----"
  local row id name port insecure prefix tier start proto
  while IFS= read -r row; do
    [[ -z "$row" ]] && continue
    IFS='|' read -r id name port insecure prefix tier start <<<"$row"
    id="$(derive_id "$id")"
    proto="http"
    [[ "$insecure" == "false" ]] && proto="https"
    printf '%-22s %-22s %-6s %-6s %-8s %s\n' "$id" "$name" "$port" "$proto" "$prefix" "$start"
  done < <(selected_rows)
}

if [[ "$PRINT_START" -eq 1 ]]; then
  echo "=== SideCar start commands (tier=$TIER) ==="
  print_catalog
  exit 0
fi

echo "=== CodeNomad SideCar generator (RedRuby-FPA) ==="
echo "  Tier:     $TIER"
echo "  Target:   $CODENOMAD_URL"
echo "  Config:   $CODENOMAD_CONFIG_YAML"
echo ""
print_catalog
echo ""

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Dry run — no changes written."
  exit 0
fi

# ── API path (preferred while CodeNomad is running) ──────────────
api_available=0
if [[ "$YAML_ONLY" -eq 0 ]]; then
  if curl -sf "${CODENOMAD_URL}/api/auth/status" >/dev/null 2>&1; then
    api_available=1
  fi
fi

register_via_api() {
  local login_code
  login_code="$(curl -sS -o /tmp/cn-login.json -w '%{http_code}' -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
    -H 'Content-Type: application/json' \
    -X POST "${CODENOMAD_URL}/api/auth/login" \
    -d "{\"username\":\"${CODENOMAD_USERNAME}\",\"password\":\"${PASSWORD}\"}")"
  if [[ "$login_code" != "200" ]]; then
    echo "Login failed (HTTP ${login_code}). Falling back to YAML." >&2
    return 1
  fi

  local existing
  existing="$(curl -sS -b "$COOKIE_JAR" "${CODENOMAD_URL}/api/sidecars")"

  local row id name port insecure prefix tier start payload code body
  while IFS= read -r row; do
    [[ -z "$row" ]] && continue
    IFS='|' read -r id name port insecure prefix tier start <<<"$row"
    id="$(derive_id "$id")"

    if echo "$existing" | grep -q "\"id\":\"${id}\""; then
      echo "  skip  /sidecars/${id}  (already registered)"
      continue
    fi

    payload="$(printf '{"kind":"port","name":%s,"port":%s,"insecure":%s,"prefixMode":%s}' \
      "$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$name")" \
      "$port" \
      "$insecure" \
      "$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$prefix")")"

    code="$(curl -sS -o /tmp/cn-sidecar-create.json -w '%{http_code}' -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
      -H 'Content-Type: application/json' \
      -X POST "${CODENOMAD_URL}/api/sidecars" \
      -d "$payload")"
    body="$(cat /tmp/cn-sidecar-create.json 2>/dev/null || true)"

    if [[ "$code" == "201" ]]; then
      echo "  add   /sidecars/${id}  →  http://127.0.0.1:${port}"
    else
      echo "  FAIL  /sidecars/${id}  HTTP ${code}: ${body}" >&2
    fi
  done < <(selected_rows)
  return 0
}

# ── YAML fallback (persists for next CodeNomad start) ────────────
resolve_yaml_module() {
  local candidate
  for candidate in \
    "${HOME}/.npm-global/lib/node_modules/@neuralnomads/codenomad/node_modules/yaml" \
    "${ROOT}/CodeNomad/node_modules/yaml" \
    "${ROOT}/CodeNomad/packages/server/node_modules/yaml"
  do
    if [[ -d "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

register_via_yaml() {
  mkdir -p "$(dirname "$CODENOMAD_CONFIG_YAML")"
  if [[ ! -f "$CODENOMAD_CONFIG_YAML" ]]; then
    printf 'server: {}\n' >"$CODENOMAD_CONFIG_YAML"
  fi

  local yaml_mod
  if ! yaml_mod="$(resolve_yaml_module)"; then
    echo "ERROR: cannot find CodeNomad 'yaml' package for config merge." >&2
    echo "Start CodeNomad and re-run without --yaml-only, or install @neuralnomads/codenomad." >&2
    exit 1
  fi

  local catalog_file
  catalog_file="$(mktemp -t codenomad-sidecar-catalog.XXXXXX)"
  selected_rows | while IFS= read -r row; do
    [[ -z "$row" ]] && continue
    IFS='|' read -r id name port insecure prefix tier start <<<"$row"
    id="$(derive_id "$id")"
    printf '{"id":"%s","name":"%s","port":%s,"insecure":%s,"prefixMode":"%s"}\n' \
      "$id" "${name//\"/\\\"}" "$port" "$insecure" "$prefix"
  done >"$catalog_file"

  CODENOMAD_CONFIG_YAML="$CODENOMAD_CONFIG_YAML" YAML_MOD="$yaml_mod" CATALOG_FILE="$catalog_file" \
  node <<'NODE'
const fs = require("fs");
const path = require("path");
const yaml = require(process.env.YAML_MOD);
const configPath = process.env.CODENOMAD_CONFIG_YAML;
const now = new Date().toISOString();

const rows = fs.readFileSync(process.env.CATALOG_FILE, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const doc = yaml.parse(fs.readFileSync(configPath, "utf8")) || {};
doc.server = doc.server && typeof doc.server === "object" ? doc.server : {};
const existing = Array.isArray(doc.server.sidecars) ? doc.server.sidecars : [];
const byId = new Map();
for (const item of existing) {
  if (item && typeof item === "object" && typeof item.id === "string") {
    byId.set(item.id, item);
  }
}

let added = 0;
for (const row of rows) {
  if (byId.has(row.id)) {
    console.log(`  skip  /sidecars/${row.id}  (already in config.yaml)`);
    continue;
  }
  byId.set(row.id, {
    id: row.id,
    kind: "port",
    name: row.name,
    port: row.port,
    insecure: row.insecure === true,
    prefixMode: row.prefixMode === "preserve" ? "preserve" : "strip",
    createdAt: now,
    updatedAt: now,
  });
  console.log(`  add   /sidecars/${row.id}  →  http://127.0.0.1:${row.port}`);
  added += 1;
}

doc.server.sidecars = Array.from(byId.values());
fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, yaml.stringify(doc));
console.log(`Wrote ${added} new SideCar(s) to ${configPath}`);
if (added) {
  console.log("Restart CodeNomad to load YAML changes (or re-run without --yaml-only while it is up).");
}
NODE

  rm -f "$catalog_file"
}

if [[ "$api_available" -eq 1 ]]; then
  echo "Registering via CodeNomad API…"
  if ! register_via_api; then
    echo "Falling back to YAML…"
    register_via_yaml
  fi
else
  if [[ "$YAML_ONLY" -eq 1 ]]; then
    echo "Writing ~/.config/codenomad/config.yaml (forced --yaml-only)…"
  else
    echo "CodeNomad not reachable at ${CODENOMAD_URL} — writing config.yaml…"
  fi
  register_via_yaml
fi

echo ""
echo "Next:"
echo "  1. Start processes:  bash scripts/generate-recommended-sidecars.sh --print-start"
echo "  2. In CodeNomad: Workspace preferences → SideCars → open a running tab"
echo "  3. Public path via tunnel: https://nomad.prestix.vip/sidecars/<id>/"
echo ""
echo "Note: UI form defaults Protocol to HTTPS — local Next/Prisma/Inngest need HTTP (insecure=true)."
