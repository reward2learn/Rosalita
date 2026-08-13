#!/usr/bin/env bash
# Configure nomad.prestix.vip on the existing Prestix Cloudflare Tunnel + Access.
# Requires: CLOUDFLARE_API_TOKEN with Account.Cloudflare Tunnel Edit + Zone.DNS Edit + Access Edit
# Optional: CLOUDFLARE_ACCOUNT_ID (auto-detected from token if omitted)
#
# Usage:
#   export CLOUDFLARE_API_TOKEN=...
#   bash scripts/configure-nomad-prestix-vip.sh
set -euo pipefail

# prestix-agents (same tunnel as codenomad.prestix.vip / opencode.prestix.vip)
TUNNEL_ID="${CLOUDFLARE_TUNNEL_ID:-4dae9434-9f91-4ddc-895b-09448162bc88}"
HOSTNAME="${CODENOMAD_SHORT_HOST:-nomad.prestix.vip}"
SERVICE="${CODENOMAD_ORIGIN:-http://127.0.0.1:9899}"
ZONE_NAME="${CLOUDFLARE_ZONE_NAME:-prestix.vip}"
API="https://api.cloudflare.com/client/v4"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for f in "${ROOT}/.env" "${ROOT}/.env.local" "/Users/iliashapiro/prestix/prestixvip/.env"; do
  if [[ -f "$f" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$f"
    set +a
  fi
done

TOKEN="${CLOUDFLARE_API_TOKEN:-${CF_API_TOKEN:-}}"
if [[ -z "$TOKEN" ]]; then
  cat >&2 <<EOF
ERROR: CLOUDFLARE_API_TOKEN is not set.

Dashboard fallback (no API token):
  1. https://one.dash.cloudflare.com/ → Networks → Tunnels
  2. Open tunnel ${TUNNEL_ID}
  3. Public Hostname → Add:
       Subdomain: nomad
       Domain: prestix.vip
       Service: ${SERVICE}
  4. Access → Applications → add ${HOSTNAME} to the same app as codenomad.prestix.vip

Then re-run: bash scripts/verify-nomad-tunnel.sh
EOF
  exit 2
fi

auth_hdr=(-H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json")

cf_get() {
  curl -sS "${auth_hdr[@]}" "$1"
}

cf_put() {
  curl -sS -X PUT "${auth_hdr[@]}" --data "$2" "$1"
}

cf_post() {
  curl -sS -X POST "${auth_hdr[@]}" --data "$2" "$1"
}

echo "==> Resolving account / zone"

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"
if [[ -z "$ACCOUNT_ID" ]]; then
  ACCOUNT_ID="$(cf_get "${API}/accounts?per_page=50" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d["result"][0]["id"] if d.get("success") and d.get("result") else "")')"
fi
if [[ -z "$ACCOUNT_ID" ]]; then
  echo "ERROR: could not resolve CLOUDFLARE_ACCOUNT_ID" >&2
  exit 1
fi
echo "  account: ${ACCOUNT_ID}"

ZONE_ID="$(cf_get "${API}/zones?name=${ZONE_NAME}" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d["result"][0]["id"] if d.get("success") and d.get("result") else "")')"
if [[ -z "$ZONE_ID" ]]; then
  echo "ERROR: zone ${ZONE_NAME} not found" >&2
  exit 1
fi
echo "  zone: ${ZONE_NAME} (${ZONE_ID})"

echo "==> Reading tunnel ingress"
CONFIG_JSON="$(cf_get "${API}/accounts/${ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}/configurations")"
python3 - "$CONFIG_JSON" "$HOSTNAME" "$SERVICE" <<'PY' > /tmp/nomad-tunnel-config.json
import json, sys
raw, hostname, service = sys.argv[1], sys.argv[2], sys.argv[3]
d = json.loads(raw)
if not d.get("success"):
    print(json.dumps(d), file=sys.stderr)
    raise SystemExit("failed to read tunnel config")
cfg = (d.get("result") or {}).get("config") or {}
ingress = list(cfg.get("ingress") or [])
# Drop catch-all temporarily; re-append at end
catch = [r for r in ingress if not r.get("hostname")]
rules = [r for r in ingress if r.get("hostname")]
found = False
for r in rules:
    if r.get("hostname") == hostname:
        r["service"] = service
        found = True
if not found:
    rules.append({"hostname": hostname, "service": service})
# Ensure codenomad remains if present historically
hostnames = {r.get("hostname") for r in rules}
new_ingress = rules + (catch if catch else [{"service": "http_status:404"}])
out = {"config": {**cfg, "ingress": new_ingress}}
json.dump(out, sys.stdout)
print(f"  ingress hosts: {sorted(hostnames)}", file=sys.stderr)
print(f"  {'updated' if found else 'added'}: {hostname} -> {service}", file=sys.stderr)
PY

echo "==> Writing tunnel ingress (includes ${HOSTNAME})"
PUT_RES="$(cf_put "${API}/accounts/${ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}/configurations" "$(cat /tmp/nomad-tunnel-config.json)")"
python3 -c 'import json,sys; d=json.load(sys.stdin); print("  ok" if d.get("success") else d)' <<<"$PUT_RES"

echo "==> Ensuring DNS CNAME ${HOSTNAME}"
EXISTING="$(cf_get "${API}/zones/${ZONE_ID}/dns_records?type=CNAME&name=${HOSTNAME}")"
REC_ID="$(python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["result"][0]["id"] if d.get("success") and d.get("result") else "")' <<<"$EXISTING")"
DNS_BODY="$(python3 -c "import json; print(json.dumps({'type':'CNAME','name':'${HOSTNAME}','content':'${TUNNEL_ID}.cfargotunnel.com','proxied':True,'ttl':1}))")"
if [[ -n "$REC_ID" ]]; then
  curl -sS -X PUT "${auth_hdr[@]}" --data "$DNS_BODY" \
    "${API}/zones/${ZONE_ID}/dns_records/${REC_ID}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  dns updated" if d.get("success") else d)'
else
  cf_post "${API}/zones/${ZONE_ID}/dns_records" "$DNS_BODY" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  dns created" if d.get("success") else d)'
fi

echo "==> Attaching Access application domain (best-effort)"
APPS="$(cf_get "${API}/accounts/${ACCOUNT_ID}/access/apps")"
python3 - "$APPS" "$HOSTNAME" "$ACCOUNT_ID" "$TOKEN" <<'PY'
import json, sys, urllib.request
apps_raw, hostname, account_id, token = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
d = json.loads(apps_raw)
if not d.get("success"):
    print("  skip Access: cannot list apps", file=sys.stderr)
    raise SystemExit(0)
target = None
for app in d.get("result") or []:
    domains = []
    for key in ("domain", "self_hosted_domains"):
        v = app.get(key)
        if isinstance(v, str):
            domains.append(v)
        elif isinstance(v, list):
            domains.extend(v)
    # also check destinations for newer schema
    for dest in app.get("destinations") or []:
        if isinstance(dest, dict) and dest.get("uri"):
            domains.append(dest["uri"].replace("https://","").replace("http://","").split("/")[0])
    joined = " ".join(domains)
    if "codenomad.prestix.vip" in joined or hostname in joined:
        target = app
        break
if not target:
    print("  skip Access: no app found for codenomad.prestix.vip — add nomad manually in Zero Trust → Access", file=sys.stderr)
    raise SystemExit(0)
app_id = target["id"]
# Prefer self_hosted_domains list when present
domains = list(target.get("self_hosted_domains") or [])
if target.get("domain") and target["domain"] not in domains:
    domains.append(target["domain"])
if hostname not in domains:
    domains.append(hostname)
body = {**{k:v for k,v in target.items() if k in (
    "name","domain","type","session_duration","auto_redirect_to_identity",
    "allowed_idps","policies","cors_headers","app_launcher_visible",
    "self_hosted_domains","destinations"
)}, "self_hosted_domains": domains}
# Minimal PUT payload
payload = {
    "name": target.get("name"),
    "domain": target.get("domain") or domains[0],
    "type": target.get("type") or "self_hosted",
    "session_duration": target.get("session_duration") or "24h",
    "self_hosted_domains": domains,
}
req = urllib.request.Request(
    f"https://api.cloudflare.com/client/v4/accounts/{account_id}/access/apps/{app_id}",
    data=json.dumps(payload).encode(),
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    method="PUT",
)
with urllib.request.urlopen(req) as resp:
    out = json.load(resp)
print("  Access updated" if out.get("success") else out)
print(f"  domains: {domains}")
PY

rm -f /tmp/nomad-tunnel-config.json
echo "Done. Verify with: bash scripts/verify-nomad-tunnel.sh"
