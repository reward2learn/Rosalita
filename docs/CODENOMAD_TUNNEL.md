# CodeNomad via Cloudflare Tunnel (Mac → nomad.prestix.vip)

Public CodeNomad for this repo:

| Hostname | Role |
|----------|------|
| **https://nomad.prestix.vip** | Short name (preferred for RedRuby-FPA) |
| **https://codenomad.prestix.vip** | Existing Prestix / StarWORLD hostname (same origin) |

Both map through Cloudflare Tunnel **prestix-agents** → local origins (see ingress below).

| Hostname | Origin (tunnel ingress) |
|----------|-------------------------|
| `codenomad.prestix.vip` | `http://localhost:9910` |
| `opencode.prestix.vip` | `http://localhost:9899` |
| **`nomad.prestix.vip`** | `http://127.0.0.1:9899` (CodeNomad) |
| `ollama.prestix.vip` | `http://localhost:11434` |

## Architecture

```text
Browser
  → https://nomad.prestix.vip
  → Cloudflare Access (ili-assistant.cloudflareaccess.com)
  → Cloudflare Tunnel prestix-agents (id 4dae9434-9f91-4ddc-895b-09448162bc88)
  → cloudflared connector on Mac Studio 192.168.1.99
  → CodeNomad http://127.0.0.1:9899  (must run on the Studio)
  → OpenCode workspace: RedRuby-FPA / tokenizmyapp
```

**Important:** remoted-managed `localhost` / `127.0.0.1` origins resolve on the **connector host** (Studio `192.168.1.99`), not the Mini (`192.168.1.92`). Running CodeNomad only on the Mini causes **502**.

## One-time Cloudflare setup

Tunnel ingress is **remotely managed** (connector uses `CLOUDFLARE_TUNNEL_TOKEN`). Local `~/.cloudflared/` may be empty.

### A) Dashboard (no API token)

1. Open [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → **Networks** → **Tunnels**
2. Open tunnel `prestix-agents` (`4dae9434-9f91-4ddc-895b-09448162bc88`)
3. **Public Hostname** → **Add**
   - Subdomain: `nomad`
   - Domain: `prestix.vip`
   - Service: `http://127.0.0.1:9899`
4. **Access** → **Applications** → edit the app that protects `codenomad.prestix.vip` → add domain `nomad.prestix.vip` (same policies)

### B) API script (DNS + ingress + Access in one shot)

```bash
export CLOUDFLARE_API_TOKEN=...   # Tunnel Edit + Zone DNS Edit + Access Edit
# If token has an IP allowlist, allow this Mac’s egress IP (or remove the filter)
bash scripts/configure-nomad-prestix-vip.sh
```

### C) `cloudflared` CLI (DNS only)

Remotely managed tunnels (`CLOUDFLARE_TUNNEL_TOKEN`) ignore a local `config.yml` for ingress. The CLI can create DNS after a one-time browser login; you still add the public hostname + Access in Zero Trust (section A) or via the API script (B).

```bash
# One-time: opens browser → Authorize Cloudflare Tunnel for prestix.vip
cloudflared tunnel login

# Creates proxied CNAME nomad.prestix.vip → <tunnel-id>.cfargotunnel.com
cloudflared tunnel route dns 4dae9434-9f91-4ddc-895b-09448162bc88 nomad.prestix.vip

# Confirm DNS
dig @1.1.1.1 +short nomad.prestix.vip A
```

Without a matching **Public Hostname** ingress rule → `http://127.0.0.1:9899`, DNS alone yields tunnel **404**.

## Daily start (Mac Studio `192.168.1.99`)

Connector for **prestix-agents** already runs on the Studio. Start CodeNomad **there**:

```bash
# On 192.168.1.99 (Studio Terminal / Screen Sharing) — not the Mini
cd /Users/iliashapiro/RedRuby-FPA   # or wherever this repo lives on the Studio
bash scripts/start-codenomad-http.sh --restart

# Health (on Studio)
curl -sS http://127.0.0.1:9899/api/auth/status
```

Then open https://nomad.prestix.vip/ (Access OTP → CodeNomad).

### Mini (`192.168.1.92`) note

Local CodeNomad on the Mini is fine for development, but it is **not** the public origin while the tunnel connector stays on the Studio.

## Verify

```bash
bash scripts/verify-nomad-tunnel.sh
```

Expect:

- local `/api/auth/status` → `200`
- `nomad.prestix.vip` DNS present
- `https://nomad.prestix.vip/` → Access `302` (until logged in) or `200`

## 502 Bad Gateway (Access works, origin fails)

Access 302/login OK but browser shows **502** usually means the **wrong tunnel connector** (or wrong host) is answering.

| Tunnel | Role on this Mac |
|--------|------------------|
| **prestix-agents** `4dae9434-…` | DNS for `nomad` / `codenomad` / `opencode` / `ollama` — must be the healthy connector |
| **Prestix-world-flare** `a9066751-…` | Token often in Prestix `.env` — **not** the DNS target for `nomad` |

If this Mac’s `cloudflared` is Prestix-world-flare while DNS points at prestix-agents, Cloudflare hits **another** machine’s `:9899` → **502**.

**Fix:** Zero Trust → **Networks** → **Tunnels** → **prestix-agents** → **Configure** → copy install token → on this Mac:

```bash
# stop the wrong connector if needed, then:
cloudflared tunnel run --token '<prestix-agents-token>'
# or put that token in RedRuby-FPA `.env` as CLOUDFLARE_TUNNEL_TOKEN and:
bash scripts/start-cloudflare-tunnel.sh
```

Confirm CodeNomad locally: `curl -sS http://127.0.0.1:9899/api/auth/status` → `200`.


## Security

- Cloudflare Access gates the public hostname — do not disable it for `nomad`.
- Never commit `CLOUDFLARE_TUNNEL_TOKEN` or `CLOUDFLARE_API_TOKEN`.
- CodeNomad password defaults for local scripts; rotate for shared use.
