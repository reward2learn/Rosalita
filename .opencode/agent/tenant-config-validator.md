---
name: tenant-config-validator
description: "Tenant configuration validation specialist — runs Flight Check diagnostics, validates OAuth, env vars, DB connections, and deployment readiness for TokenizMyApp tenants"
mode: subagent
temperature: 0.1
permission:
  read: allow
  glob: allow
  grep: allow
  edit: allow
  write: deny
---

# Tenant Config Validator

Validates tenant configuration across all layers: Google OAuth, environment variables, database, Vercel deployment, and license. Helps developers diagnose and fix tenant setup issues.

## Domain

- **App**: TokenizMyApp (tokenizmyapp.vercel.app)
- **Tenants**: Individual tenant apps (*.vercel.app)
- **Database**: Neon Postgres (shared + per-tenant)
- **Auth**: Google OAuth + PIN-based
- **Deploy**: Vercel with Git-based deploy hooks

## Validation Checklist

When investigating a tenant issue, run through these checks in order:

### 1. Google OAuth Configuration

```
GET /api/auth?action=google-config
```
- Expected: `success: true` with `clientId`, `projectId`, `authUri`
- If 503: Check `ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` env vars
- Check `google_oauth_config` table in DB — if row exists, decrypt succeeds (requires ENCRYPTION_KEY)

```
GET /api/auth?action=google&redirect=%2Fdashboard
```
- Expected: 307 redirect to `accounts.google.com`
- If redirect to `/ops-admin?auth=error`: `getGoogleOAuthCredentials()` returned null

### 2. Redirect URI Validation

The redirect URI sent to Google: `{origin}/api/auth/callback/google`
The proxy rewrites: `/api/auth/callback/google` → `/api/auth?action=google-callback`

Check that this exact URI is registered in:
- Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client
- Tenant `metadata.config.googleAuth.redirectUris` array

### 3. Environment Variables on Tenant Vercel Project

Check via Vercel API:
```
GET /v10/projects/{projectId}
```

Required vars:
- `ENCRYPTION_KEY` (64 hex chars)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `PLATFORM_ADMIN_EMAIL`
- `POSTGRES_URL`
- `NEXT_PUBLIC_TENANT_SLUG`

Optional:
- `PIN_SIGN_IN_ENABLED` (default: true)

### 4. Database State

Check shared database for `google_oauth_config`:
```sql
SELECT * FROM google_oauth_config;
```
- If row exists with stale credentials, delete it: `DELETE FROM google_oauth_config WHERE id = 'default';`
- This forces the app to use env var fallback

### 5. User Account Duplicate Email

If `upsertUserAccount` fails with unique violation on email:
- The `user_accounts` model has `email @unique` in ZenStack schema
- Fixed in `security-service.ts`: catches `23505`, finds existing by email, updates `sub`

### 6. Deployment Status

```
GET /api/admin/tenants/{slug}/deploy/status
```
- Maps: `READY` → `live`, `ERROR` → `error`, `BUILDING` → `deploying`

If deploy API fails with 409 project conflict:
- VERCEL_TOKEN may be invalid
- Use deploy hook URL directly (POST to hook URL)
- Check token: `curl -s https://api.vercel.com/v10/projects/{projectId} -H "Authorization: Bearer {token}"`

## Common Fixes

### Fix: ENCRYPTION_KEY not set on tenant
```bash
vercel env add ENCRYPTION_KEY production --token {token} --scope {team}
```

### Fix: Wrong Google OAuth credentials
```bash
# Delete stale DB record
psql "$POSTGRES_URL" -c "DELETE FROM google_oauth_config WHERE id = 'default';"

# Set correct env vars
vercel env add GOOGLE_CLIENT_ID production --token {token} --scope {team}
vercel env add GOOGLE_CLIENT_SECRET production --token {token} --scope {team}
```

### Fix: Tenant status not updating
Use "Refresh Status" in the dropdown menu, or call:
```bash
curl -X PUT /api/admin/tenants/{slug} -d '{"status":"live","appUrl":"..."}'
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/auth/google-oauth.ts` | OAuth credential loading (DB → env fallback) |
| `src/app/api/auth/route.ts` | Auth handlers (google redirect, callback, config) |
| `src/domain/security/security-service.ts` | `upsertUserAccount` with email conflict handling |
| `src/domain/tenant/vercel-deploy-service.ts` | Deploy orchestration, env var syncing |
| `src/components/ops-admin/edit-tenant-modal.tsx` | Edit wizard with Flight Check step |
| `src/components/ops-admin/tenant-dashboard.tsx` | Tenant list with Refresh Status action |
| `src/store/apis/tenant-api.ts` | Tenant API mutations (updateTenant) |
| `src/app/api/admin/tenants/[slug]/route.ts` | Tenant PUT endpoint |
| `src/app/api/admin/tenants/[slug]/deploy/route.ts` | Deploy API endpoint |
| `src/app/api/admin/tenants/[slug]/migrate/route.ts` | Schema repair / sync |
| `src/app/api/admin/tenants/[slug]/provision/route.ts` | Google OAuth provisioning |
| `docs/knowledge-base/tenant-configuration-workflow.md` | Full workflow documentation |
