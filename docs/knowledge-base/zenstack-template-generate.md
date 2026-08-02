# ZenStack Template Generate — Runtime Augmentation Clobbering

**Status:** Resolved (2026-08-02) · **Severity:** High (breaks main tsc) · **Recovery:** 1 command

## Overview

`zenstack generate` against the tenant base template schema (`templates/base/zenstack/schema.zmodel`) run from the workspace root **clobbers the main app's ZenStack runtime augmentation**, breaking main TypeScript compilation with dozens of "missing model" errors. Root cause, mechanism, safe procedure, and recovery are documented here.

## Root Cause

ZenStack's enhancer plugin writes schema-specific type augmentation to `{node_modules}/.zenstack` — the `DEFAULT_RUNTIME_LOAD_PATH` (`'.zenstack'`) joined onto the `node_modules` folder that contains the **CLI's resolved** `@zenstackhq/runtime` package.

Resolution logic (`node_modules/zenstack/plugins/plugin-utils.js` → `getDefaultOutputFolder`):

```
runtimeModulePath = require.resolve('@zenstackhq/runtime')   // resolved from the CLI's own location
modulesFolder    = walk up to the containing node_modules
output           = {modulesFolder}/.zenstack
```

The output is **not** derived from the `--schema` argument's project. With the template schema and a root-cwd invocation, the CLI (in `tokenizmyapp/node_modules/zenstack`) resolves `@zenstackhq/runtime` to the **main app's** copy → output = `tokenizmyapp/node_modules/.zenstack`.

Then `ensureDefaultOutputFolder` runs `ensureEmptyDir(output)` — **wiping the shared augmentation** — and rewrites it with the **template schema's** content (template models, logical prisma client).

## Symptoms

- Main `bun run tsc --noEmit --skipLibCheck` fails with dozens of errors:
  - `Property 'businessReviewPart' does not exist on type 'PrismaClient<PrismaClientOptions, never, DefaultArgs>'`
  - `Property 'dailyZReport' does not exist ...`, `Property 'monthlyTarget' does not exist ...`
- The main generated client (`src/generated/prisma/`) and runtime packages are **untouched** — only `node_modules/.zenstack` changes
- `git status` stays clean (the augmentation is gitignored) — easy to miss the cause

## Mechanism Timeline (empirically verified 2026-08-02)

| Step | Command (cwd) | Effect |
|------|---------------|--------|
| Baseline | — | main tsc: 0 errors; main `node_modules/.zenstack` holds main-schema augmentation |
| Clobber | `bunx zenstack generate --schema templates/base/zenstack/schema.zmodel` (from `tokenizmyapp/`) | `ensureEmptyDir` wipes `node_modules/.zenstack`; template-schema augmentation written there; main tsc → **54 errors** |
| Restore | `bunx zenstack generate --schema zenstack/schema.zmodel` (from `tokenizmyapp/`) | main-schema augmentation restored; main tsc → **0 errors** |
| Isolated (FIX) | `bunx zenstack generate --schema zenstack/schema.zmodel` (cwd = `templates/base/`) | writes `templates/base/node_modules/.zenstack` (template's own copy); main augmentation hash-identical; main tsc → **0 errors**; git clean |

Verified invariants:
- Main runtime package (`node_modules/@zenstackhq/runtime/`) and template runtime package were never modified by any generate run (pristine install mtimes)
- Main client (`src/generated/prisma/`) is never touched by template generates
- The 54-error signature exactly matches the template schema (template models substituted for main models in the shared augmentation)

## Safe Procedure (going forward)

```bash
# Template schema generate — ALWAYS from templates/base cwd
cd tokenizmyapp/templates/base
bunx zenstack generate --schema zenstack/schema.zmodel

# Restore committed client index.js (cwd-relative fallback paths differ)
git checkout src/generated/prisma/index.js   # relative to templates/base

# Verify main app unaffected
cd tokenizmyapp
bun run tsc --noEmit --skipLibCheck          # expect 0 errors
```

## Recovery (if a root-cwd template generate happens anyway)

```bash
cd tokenizmyapp
bunx zenstack generate --schema zenstack/schema.zmodel   # restores main augmentation
bun run tsc --noEmit --skipLibCheck                       # verify: 0 errors
```

## What is NOT affected

- **Tenant apps**: `src/domain/tenant/migration-runner.ts` writes the tenant zmodel to a temp dir and runs `npx zenstack generate` with cwd inside the generated app → tenant-scoped `node_modules/.zenstack`
- **Main schema generates** from the workspace root (always safe)
- **Git state**: `node_modules/.zenstack` is gitignored; nothing tracked changes during the incident

## Bonus Finding

Running the template generate from `templates/base/` cwd also gives the template its own correct augmentation — the template's standalone tsc dropped from 225+4 errors to **221** (the 4 residual `taskUserAssignment` typing errors disappeared).

## Key Files

| Path | Role |
|------|------|
| `node_modules/zenstack/plugins/plugin-utils.js` | `getDefaultOutputFolder` — require.resolve-based output resolution (root cause) |
| `node_modules/zenstack/plugins/enhancer/index.js` | `ensureDefaultOutputFolder` + `ensureEmptyDir` wipe behavior |
| `node_modules/.zenstack/` | Shared augmentation — main schema after restore |
| `templates/base/node_modules/.zenstack/` | Template's own augmentation (isolated run) |
| `templates/base/zenstack/schema.zmodel` | Tenant base template schema |
| `src/domain/tenant/migration-runner.ts` | Per-tenant isolated generate flow (unaffected) |

## Related

- Skill: `.opencode/skills/zenstack-template-generate/SKILL.md`
- Lesson: `.opencode/context/project-intelligence/errors/zenstack-template-generate-clobber.md`
- Debugging lessons: `.opencode/context/project-intelligence/debugging-lessons.md`
