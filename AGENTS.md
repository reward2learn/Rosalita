# RedRuby-FPA — AGENTS.md

**Dual-purpose project**: Prestix / Promohub / TokenizMyApp (`tokenizmyapp/`) + Rosalita Cantina restaurant operations.

This file defines the agent architecture for both **CodeNomad** and **OpenCode** orchestrators.

---

## Environment (current)

| Path | Purpose |
|------|---------|
| `tokenizmyapp/` | **Next.js 16 application root** — App Router, components, API, ZenStack |
| `.codenomad/` | CodeNomad orchestration (`nomadworks.yaml` + agents/) |
| `CodeNomad/` | CodeNomad tool source — **never modify** |
| `.opencode/` | OpenCode config, agents, context |
| `menu.txt` | Restaurant menu (IDR thousands) |
| `docs/` | Diagnostics & migration docs |
| `docs/CODENOMAD_TUNNEL.md` | Cloudflare tunnel: **https://nomad.prestix.vip** (alias `codenomad.prestix.vip`) → `:9899` |
| `scripts/start-codenomad-http.sh` | Start CodeNomad on `127.0.0.1:9899` |
| `scripts/start-cloudflare-tunnel.sh` | Start `cloudflared` connector |

> There is **no** active `website/` app directory. Use `tokenizmyapp/` for all app work.
> Public CodeNomad: **https://nomad.prestix.vip** (Cloudflare Access + Tunnel).
---

## Dual entrypoints (orchestrators)

| Entry | Primary agent | Use for |
|-------|---------------|---------|
| **CodeNomad** (UI / `scripts/start-codenomad-http.sh`) | `project-manager` | Multi-agent Task assignment to **all** registered subagents |
| **OpenCode** (CLI / TUI) | `opencoder` | App coding director — same Task stack, coding-first prompts |

CodeNomad overlay: `.codenomad/opencode-defaults.json` sets `default_agent: project-manager` via `OPENCODE_CONFIG_CONTENT`.  
Standalone OpenCode keeps `.opencode/opencode.json` → `default_agent: opencoder`.

### Primary agents

| Agent | When to use |
|-------|-------------|
| `project-manager` | **CodeNomad default** — multi-agent orchestrator; `Task` to any subagent (does not edit files itself) |
| `opencoder` | **OpenCode default** — app feature director; `Task({ subagent_type })` to `website-*` |
| `openagent` | Light Q&A / routing |
| `legal-orchestrator` | Equity / contracts / Indonesian law |

### Task tool schema (critical)

Every Task call **must** include `subagent_type`:

```
Task({
  subagent_type: "website-ui",
  description: "Template selection UI",
  prompt: "Implement Multi-App Suite option in tokenizmyapp/..."
})
```

Missing `subagent_type` → `SchemaError(Missing key at ["subagent_type"])`.

---

## CodeNomad / OpenCode Agent Architecture

### Orchestrator Layer

| Agent | Role | Mode / entry |
|-------|------|----------------|
| `project-manager` | Multi-agent Task assignment to all subagents | primary — **CodeNomad default** |
| `opencoder` | App feature orchestration (`website-*`) | primary — **OpenCode default** |
| `website-migration-commander` | Migration phases — **COMPLETE / archival** | disabled in OpenCode |

**ID rule:** NomadWorks agent keys = OpenCode agent ids = Task `subagent_type` (hyphens only).

### Restaurant Operations

| Agent | Role | Permissions |
|-------|------|-------------|
| `business-analyst` | Menu & pricing analysis | read-only |
| `copywriter` | Menu copy, descriptions, promo text | edit `menu.txt` only |
| `tenant-config-validator` | Tenant / Flight Check / OAuth / env / DB | read-only |
| `data-analyst` | Cashflow insights | read-only |
| `cfo` | Financial review | read-only |
| `coo` | Operations management | edit `menu.txt` only |
| `reviewer` | Quality gate | read-only gate |

### AI Content Generation

| Agent | Role | Permissions |
|-------|------|-------------|
| `ai-content-generator` | 3-phase AI gen (BR → ES → Dashboard Data) | read-only orchestration |
| `ai-content-reviewer` | Quality review of generated content | read-only |

### Website Application Development (`tokenizmyapp/`)

| Agent (`subagent_type`) | Role | Write scope |
|-------------------------|------|-------------|
| `website-nextjs` | App Router pages, layouts | `tokenizmyapp/src/app/` |
| `website-ui` | MUI v9 components, theme | `tokenizmyapp/src/components/`, `theme/` |
| `website-db` | ZenStack schema, seed | `tokenizmyapp/zenstack/` |
| `website-api` | API routes, Zod, SSE | `tokenizmyapp/src/app/api/` |
| `website-state` | RTK Query + slices + RHF — no Zustand | `tokenizmyapp/src/store/` |
| `website-auth` | JWT cookies, Google OAuth, PIN | `tokenizmyapp/src/lib/auth/` |
| `website-testing` | Vitest + RTL | `tokenizmyapp` tests |
| `website-deploy` | Vercel / env / build gate | read-only |

### Website Migration (archival)

Migration P0–P9 shipped. Prefer `website-*` app agents above for new work. Migration agents remain under `.opencode/agent/website-migration/` for historical tasks only.

### Legal Investigation & Compliance

| Agent | Role | Permissions |
|-------|------|-------------|
| `legal-orchestrator` | Top-level legal delegator | read-only orchestration |
| `legal-research-analyst` | Putusan MA / case law | read-only |
| `equity-compliance-specialist` | PT ownership / UU PT | read-only |
| `contract-oversight-advisor` | KUHPerdata contracts | read-only |
| `legal-security-oversight` | UU PDP / anti-fraud | read-only |

---

## Workflows

### Restaurant Operations
- **menu_change**: analyst → copywriter → coo → cfo → reviewer
- **menu_audit**: analyst → data-analyst → cfo → reviewer
- **new_menu_item**: coo → analyst → cfo → copywriter → reviewer

### AI Content
- **ai_content_generation**: generator (3 phases) → reviewer

### Website / App
- **website_feature**: db → api → state → ui → nextjs → testing → deploy  
  Orchestrated by `opencoder` via Task(`subagent_type`).

### Legal
- **legal_equity_investigation**: research → equity → contract → security → orchestrator
- **legal_contract_review**: contract → research → equity → security → orchestrator
- **legal_full_audit**: research → equity → contract → security → orchestrator

---

## Constraints

- **Never modify** `CodeNomad/` source
- **App directory is `tokenizmyapp/`** — all Next.js development happens there
- Prices are in **IDR thousands** (98 K = 98,000 IDR)
- Edit `menu.txt` only for menu text changes
- Never modify images or spreadsheet files directly
- OpenCode Task calls must always include `subagent_type` with a **hyphenated** agent id
- `project-manager` (CodeNomad) may Task **any** registered subagent (`permission.task: *`); it must not edit files itself — specialists write
