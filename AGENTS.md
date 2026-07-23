# RedRuby-FPA — AGENTS.md

**Dual-purpose project**: Prestix.vip / Promohub web application (`website/`) + Rosalita Cantina restaurant operations.

This file defines the agent architecture for both **CodeNomad** and **OpenCode** orchestrators.

---

## CodeNomad Agent Architecture

### Orchestrator Layer

| Agent | Role | Mode |
|-------|------|------|
| `project_manager` | Orchestrates restaurant ops workflows | subagent |
| `website_migration_commander` | Orchestrates website migration phases | subagent |

### Restaurant Operations

| Agent | Role | Permissions |
|-------|------|-------------|
| `business_analyst` | Menu & pricing analysis | read-only |
| `copywriter` | Menu copy, descriptions, promo text | edit menu.txt only |
| `data-analyst` | Cashflow data review & insights | read-only |
| `cfo` | Financial review, profitability | read-only |
| `coo` | Operations management | edit menu.txt only |
| `reviewer` | Quality gate before menu changes | read-only gate |

### AI Content Generation

| Agent | Role | Permissions |
|-------|------|-------------|
| `ai_content_generator` | 3-phase AI gen (BR → ES → Dashboard Data) | read-only orchestration |
| `ai_content_reviewer` | Quality review of generated content | read-only |

### Website Application Development

| Agent | Role | Permissions |
|-------|------|-------------|
| `website_nextjs` | Next.js 16 App Router pages, layouts, middleware | write website/src/app/ |
| `website_ui` | MUI v9 components, theme — no Tailwind | write website/src/components/, theme/ |
| `website_db` | ZenStack v2 schema, Prisma, seed scripts | write website/zenstack/ |
| `website_api` | API route handlers, auth, Zod validation, SSE | write website/src/app/api/ |
| `website_state` | RTK Query (11 APIs) + uiSlice + chatStreamSlice + RHF — no Zustand | write website/src/store/ |
| `website_auth` | JWT cookie auth (jose), Google OAuth, PIN | write website/src/lib/auth/ |
| `website_testing` | Vitest + RTL | write website/src/__tests__/ |
| `website_deploy` | Vercel deployment, env config, build | read-only |

### Website Migration (Legacy → Current)

| Agent | Role | Permissions |
|-------|------|-------------|
| `website_migration_commander` | Phase orchestration (MIGRATION COMPLETE — P0–P9 shipped) | read-only orchestration |
| `website_use_case_analyst` | USE-CASES.md derivation & validation (archival) | read-only docs |
| `website_legacy_api_analyst` | Legacy API audit & inventory (archival) | read-only docs |
| `website_migration_planner` | Roadmap + TaskManager manifests (archival) | read-only planning |

---

## Workflows

### Restaurant Operations
- **menu_change**: analyst → copywriter → coo → cfo → reviewer
- **menu_audit**: analyst → data-analyst → cfo → reviewer
- **new_menu_item**: coo → analyst → cfo → copywriter → reviewer

### AI Content
- **ai_content_generation**: generator (3 phases) → reviewer

### Website
- **website_feature**: db → api → state → ui → nextjs → testing → deploy

---

## Important Paths

| Path | Purpose |
|------|---------|
| `website/` | **Next.js 16 application root** — App Router, components, API |
| `.codenomad/` | CodeNomad orchestration config (nomadworks.yaml + agents/) |
| `CodeNomad/` | CodeNomad tool source code |
| `menu.txt` | Restaurant menu (IDR thousands) |
| `.opencode/` | OpenCode configuration and context |
| `docs/` | Documentation, diagnostics, migration docs |
| `*.xlsx` | Financial workbooks (cashflow, budgets) |
| `*.md` (root) | AI-generated Business Review and Executive Summary files |

---

## Constraints

- **Never modify** `CodeNomad/` source — it is the orchestrator tool, not part of this project
- **website/ is the app directory** — all Next.js development happens inside `website/`
- Prices are in **IDR thousands** (98 K = 98,000 IDR)
- Edit `menu.txt` only for menu text changes
- Never modify images or spreadsheet files directly
