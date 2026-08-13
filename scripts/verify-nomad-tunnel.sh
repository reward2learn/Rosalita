#!/usr/bin/env bash
# Verify local CodeNomad + Cloudflare hostnames for nomad / codenomad.
set -euo pipefail

PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:${PATH:-}"

ok=0
fail=0

check() {
  local label="$1" cmd="$2"
  echo -n "• ${label}: "
  if eval "$cmd"; then
    echo "OK"
    ok=$((ok+1))
  else
    echo "FAIL"
    fail=$((fail+1))
  fi
}

echo "=== CodeNomad / Cloudflare tunnel verify ==="

check "single cloudflared process" \
  '[[ $(pgrep -f "cloudflared tunnel" | wc -l | tr -d " ") -ge 1 ]]'

check "local :9899 listening" \
  'lsof -nP -iTCP:9899 -sTCP:LISTEN >/dev/null'

check "local /api/auth/status" \
  'code=$(curl -sS -m 5 -o /dev/null -w "%{http_code}" http://127.0.0.1:9899/api/auth/status); [[ "$code" == "200" ]]'

echo -n "• DNS nomad.prestix.vip: "
NOMAD_DNS="$(dig +short nomad.prestix.vip CNAME; dig +short nomad.prestix.vip A)"
if [[ -n "$(echo "$NOMAD_DNS" | tr -d '\n')" ]]; then
  echo "OK ($NOMAD_DNS)" | tr '\n' ' '; echo
  ok=$((ok+1))
else
  echo "FAIL (no records — add Public Hostname in Zero Trust)"
  fail=$((fail+1))
fi

for host in nomad.prestix.vip codenomad.prestix.vip; do
  echo -n "• https://${host}/ (expect Access 302 or 200): "
  code=$(curl -sS -m 10 -o /dev/null -w "%{http_code}" "https://${host}/" 2>/dev/null || echo "000")
  if [[ "$code" == "302" || "$code" == "200" || "$code" == "401" ]]; then
    echo "OK (HTTP ${code})"
    ok=$((ok+1))
  else
    echo "FAIL (HTTP ${code})"
    fail=$((fail+1))
  fi
done

echo "---"
echo "passed=${ok} failed=${fail}"
[[ "$fail" -eq 0 ]]
