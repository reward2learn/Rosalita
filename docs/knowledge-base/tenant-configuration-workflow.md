# Tenant Configuration Workflow

## Overview

This document records all known configuration issues, resolved workflows, and best practices for setting up and validating tenant applications in the TokenizMyApp platform.

## Resolved Issues

### 1. Google OAuth Redirect URI Mismatch

**Issue:** Google returned `redirect_uri_mismatch` because the URI the app sent to Google didn't match what was registered in Google Cloud Console.

**Symptoms:**
- `Error 400: redirect_uri_mismatch` from Google's OAuth page
- User can start Google sign-in but gets redirected to error page

**Resolution:**
- The app sends: `{origin}/api/auth/callback/google`
- The proxy rewrites: `/api/auth/callback/google` → `/api/auth?action=google-callback` (server-side)
- Google Cloud Console OAuth client must have `{origin}/api/auth/callback/google` as an Authorized redirect URI
- Both the provision flow and the code must agree on the same URI

**Verification:**
- `GET /api/auth?action=google-config` returns `clientId` and config
- `GET /api/auth?action=google&redirect=%2Fdashboard` returns 307 redirect to Google

### 2. ENCRYPTION_KEY Not Set on Tenant Project

**Issue:** `getGoogleOAuthCredentials()` fails with `ENCRYPTION_KEY not set` because the env var is missing on the tenant's Vercel project.

**Symptoms:**
- `google-config` returns "Google OAuth not configured" (503)
- Logs show: `[google-oauth] DB load failed, trying env fallback: ENCRYPTION_KEY not set`
- JWT session signing fails silently

**Resolution:**
- `ENCRYPTION_KEY` must be set on each tenant's Vercel project env vars (Production)
- It's the same 64-char hex value as the root `tokenizmyapp` project
- It's required for: decrypting stored OAuth secrets, signing JWT session tokens

**Verification:**
- `GET /api/auth?action=google-config` returns valid config (not 503)
- User can complete Google sign-in flow

### 3. VERCEL_TOKEN Invalid

**Issue:** The `VERCEL_TOKEN` env var on the `tokenizmyapp` project was invalid/expired, preventing the deploy API from looking up or syncing env vars to tenant Vercel projects.

**Symptoms:**
- Deploy API returns 500 with project lookup 409 error
- `ensureVercelProject` can't find or create projects

**Resolution:**
- Generate a new team-scoped Vercel token via Vercel Dashboard → Settings → Tokens
- Update `VERCEL_TOKEN` on the `tokenizmyapp` Vercel project
- The deploy hook URL bypasses this issue (has embedded auth)

### 4. Google OAuth Client ID/Secret Wrong

**Issue:** The tenant metadata stored incorrect OAuth credentials from an earlier provisioning attempt, while the actual Google Cloud Console OAuth client had different credentials.

**Symptoms:**
- `google-config` returned the wrong `clientId`
- Google sign-in failed with `redirect_uri_mismatch` even though the URI was registered
- The error showed a different `client_id` than expected

**Resolution:**
- Delete the stale `google_oauth_config` DB record: `DELETE FROM google_oauth_config WHERE id = 'default';`
- Set correct `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars on the tenant's Vercel project
- The `getGoogleOAuthCredentials()` function falls back to env vars when DB record is missing

### 5. Email Unique Constraint on Google Sign-In

**Issue:** `upsertUserAccount` failed with `Key (email)=(...) already exists` because the `user_accounts` model has `email @unique` in the ZenStack schema, but the upsert only handled `ON CONFLICT (sub)`.

**Symptoms:**
- Google sign-in succeeds with Google but session creation fails
- Log shows PostgreSQL unique violation on `email` column

**Resolution:**
- Fixed `upsertUserAccount` in `security-service.ts` to catch `23505` (unique violation on email)
- On conflict, finds existing user by email and updates their `sub` to the Google ID
- This merges seed accounts with Google-authenticated identities

### 6. Tenant Status Not Updating

**Issue:** After successful deployment, the tenant's `status` field remained `error` instead of updating to `live`.

**Symptoms:**
- Dashboard shows `error` despite the app working
- `deploy/status` API returns `READY` but the tenant record says `error`

**Resolution:**
- The "Refresh Status" menu item now calls `updateTenant` to persist status and appUrl
- It also syncs `apiKey` from metadata to the top-level field
- The table refetches after the update

## Configuration Validation (Flight Check)

The "Flight Check" step in the Edit Tenant wizard validates:

| Check | Source | Pass/Fail Condition |
|-------|--------|---------------------|
| Google OAuth Client ID | `metadata.config.googleAuth.clientId` | Must be non-empty |
| Google OAuth Client Secret | `metadata.config.googleAuth.clientSecret` | Must be non-empty |
| Google OAuth Project ID | `metadata.config.googleAuth.projectId` | Should be set |
| Redirect URI | `metadata.config.googleAuth.redirectUris` | Must include `/api/auth/callback/google` |
| License Key | `metadata.config.license.key` | Must be non-empty |
| License Tier | `metadata.config.license.tier` | Should be set |
| License Expiry | `metadata.config.license.validUntil` | Must be in the future |
| API Key | `metadata.config.apiKey` | Must be non-empty |
| Database URL | `metadata.config.database.databaseUrl` | Must be non-empty |
| Deploy Hook URL | `metadata.config.hooks.deployHookUrl` | Should be valid format |
| Vercel Project ID | `tenant.vercelProjectId` | Must be non-empty |
| Admin Email | `metadata.config.auth.adminEmail` | Must be non-empty |
| PIN Sign-in | `metadata.config.auth.pinSignInEnabled` | Should be configured |
| OpenAI API Key | `metadata.config.openaiApiKey` | Should be set |
| Tenant Status | `tenant.status` | Should be `live` |

## Workflows

### Deploy with Git (Recommended)

1. Go to Edit Tenant modal → Configure all steps
2. Click "Save Changes" to persist config
3. Click "Deploy with Git" → POSTs to deploy hook URL directly (bypasses VERCEL_TOKEN)
4. Deploy hook triggers production build from git main branch
5. Monitor status via "Refresh Status" or "Check Status" menu items

### Setting Up Google OAuth for a New Tenant

1. Create OAuth 2.0 Client in Google Cloud Console:
   - Application type: Web application
   - Authorized redirect URIs: `https://{slug}.vercel.app/api/auth/callback/google`
2. Get the Client ID and Client Secret
3. In Edit Tenant modal → Google OAuth step, enter the credentials
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars on the tenant's Vercel project
5. If using shared project, delete `google_oauth_config` table row so env fallback works

### Troubleshooting Google Sign-In

1. Check `GET /api/auth?action=google-config` — should return clientId
2. Check `GET /api/auth?action=google&redirect=%2Fdashboard` — should 307 to Google
3. If both work, the OAuth config is correct
4. If sign-in still fails, check browser console for `redirect_uri_mismatch`
5. Verify the exact redirect URI is registered in Google Cloud Console
6. Check `GET /api/auth?action=me` after sign-in — should show user data

## Environment Variables Required on Tenant Vercel Project

| Variable | Required | Purpose |
|----------|----------|---------|
| `ENCRYPTION_KEY` | Yes | JWT signing, secret decryption |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth |
| `PLATFORM_ADMIN_EMAIL` | Yes | Maps Google email to admin role |
| `PIN_SIGN_IN_ENABLED` | No | Toggle PIN sign-in (default: true) |
| `POSTGRES_URL` | Yes | Database connection |
| `NEXT_PUBLIC_TENANT_SLUG` | Yes | Tenant identifier |
