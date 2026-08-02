# Knowledge Base — Index

Canonical operational knowledge for the RedRuby-FPA / TokenizMyApp workspace. Each doc records a resolved incident, workflow, or safe procedure so agents never re-investigate from scratch.

## Documents

| Doc | Topic | Status |
|-----|-------|--------|
| [tenant-configuration-workflow.md](tenant-configuration-workflow.md) | Tenant provisioning — OAuth, env vars, Flight Check, deploy | Resolved |
| [website-migration.md](website-migration.md) | Legacy → Next.js 16 website migration | Migration complete (P0–P9) |
| [zenstack-template-generate.md](zenstack-template-generate.md) | Safe `zenstack generate` for templates/base — `.zenstack` augmentation clobbering incident | Resolved (2026-08-02) |

## Rules for adding docs

- Every resolved incident or gotcha deserves an entry here **and** a lesson in `.opencode/context/project-intelligence/`
- Keep the postmortem format: Overview → Root Cause → Symptoms → Timeline → Safe Procedure → Recovery → Key Files
- Cross-link the related skill (`.opencode/skills/<name>/SKILL.md`) and error doc
