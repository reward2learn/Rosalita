# Webhook System Architecture and Documentation

## Overview

The webhook system enables real-time notifications for platform events such as tenant lifecycle (creation, template amendment, deployment), Vercel deploy status, payment events, and custom business events. It is implemented as a robust, configurable outbound webhook manager integrated into the ops-admin interface.

**Key Features:**
- Multi-provider support (Vercel, Stripe, custom, GitHub)
- Event subscription model with flexible matching (`tenant.*`, `deploy.*`, `custom.*`)
- Persistent event logging with retry status tracking
- Test firing capability from UI
- Platform admin only access (guarded by JWT + `sessionIsPlatformAdmin`)
- Delta-driven template amendments trigger relevant events
- Integration with Inngest for orchestration

## Architecture

### Backend (API Routes)
- **Primary Endpoint**: `website/src/app/api/admin/webhooks/route.ts`
  - GET: List configs + event counts
  - POST: Create new webhook config
  - PUT: Update (including toggle active, change events)
  - DELETE: Remove config (cascades to event log)
- **Database Schema** (ZenStack/Prisma):
  - `WebhookConfig` model: provider, endpoint, events (JSON array), secret (encrypted), isActive, lastTriggered
  - `WebhookEventLog` model: configId, eventType, status (pending/success/failed), payload, response details, timestamps
- **Auth**: `requireWriteAuth()` + platform admin check. Uses `X-Session-*` headers from proxy.ts for fast path.
- **Event Dispatch**: Inngest handlers or direct HTTP POST with signature verification (HMAC using secret).
- **Retry Logic**: Configurable (not shown in basic impl; extend with Inngest).

### Frontend
- `website/src/components/ops-admin/webhook-manager.tsx`
  - Table view of configs with status, event count, last triggered
  - Inline editing dialog with Zod-validated form
  - Event history drawer with payload/response inspection
  - Test button that triggers `testWebhook` mutation (sends `test.webhook` event)
- RTK Query integration via `admin-api.ts` (tags: 'Webhooks', 'WebhookEvents')
- Real-time updates via invalidation on test/create/update/delete

### Event Catalog (Core Events)
```ts
// Common events emitted by the platform
const PLATFORM_EVENTS = [
  'tenant.created',
  'tenant.updated',
  'tenant.template.amended',  // Key for reseller onboarding & template changes
  'tenant.deployed',
  'tenant.deploy.failed',
  'deploy.started',
  'deploy.success',
  'deploy.failed',
  'payment.succeeded',
  'payment.failed',
  'review.completed',
  'ai.content.generated',
  'test.webhook',  // For testing
  'custom.*'       // Wildcard for business-specific
];
```

Events include rich payload with tenant slug, template ID, delta summary, schema.org metadata, previousTemplate for rollback.

## Testing

### Using the UI
1. Navigate to Ops Admin → Webhooks tab
2. Create webhook with endpoint (use https://webhook.site or ngrok)
3. Select events (include `test.webhook`, `tenant.template.amended`)
4. Click "Test" button — observes success toast and event log entry
5. Inspect payload in event history drawer

### Script-Based Testing
See `tokenizmyapp/scripts/test-webhook.ts` (updated with comprehensive scenarios below).

**Comprehensive Test Cases (updated):**
- Basic test event
- Tenant creation simulation
- Template amendment (default → financial-analytics, restaurant → reseller-onboarding)
- Deploy success/failure with Vercel payload simulation
- Delta preview events with page/nav/color diffs
- Reseller onboarding flow: new reseller tenant creation, partner assignment, commission setup
- Error cases: invalid endpoint (404/5xx), timeout, bad secret
- High-volume: 10 concurrent events
- Schema.org aligned payloads for business templates

Run with:
```bash
cd tokenizmyapp
bun run test-webhook
# or with specific scenario
bun run test-webhook --scenario=template-amendment
```

### Unit/Integration Tests
- `webhook-manager.test.tsx` (to be added): RTL tests for form, table, event log
- API route tests using Vitest + mock DB
- Validate signature verification, retry counts, payload sanitization

## Troubleshooting

### Common Issues
1. **Webhook not firing**
   - Check `isActive: true`
   - Verify events array includes the triggered event type (use `custom.*` for broad catch)
   - Inspect server logs for dispatch errors
   - Confirm endpoint is publicly reachable (no localhost, use ngrok for dev)

2. **401/403 on delivery**
   - Endpoint must accept POST with `X-Webhook-Signature` or `Authorization: Bearer <secret>`
   - Platform admin JWT must be valid for test events

3. **Event log shows 'failed'**
   - Check `responseCode`, `errorMessage` in event drawer
   - Common: timeout (>30s), non-2xx response, JSON parse error on endpoint
   - Increase timeout in dispatch logic if needed

4. **Template Amendment Events Missing**
   - Ensure `tenant.template.amended` is subscribed
   - Verify Inngest handler for `tenant.template.amended` is registered and emits webhook
   - Check delta computation in `tenant-service.ts`

5. **Vercel-specific**
   - Use provider='vercel', endpoint from Vercel dashboard
   - Events like `deployment.succeeded` map to internal `deploy.success`

### Debugging Commands
```bash
# List all webhooks and recent events
bunx prisma studio  # inspect webhookConfig, eventsLog tables

# Test specific event via API
curl -X POST http://localhost:3000/api/admin/webhooks/test \
  -H "Authorization: Bearer $SETUP_TOKEN" \
  -d '{"eventType": "tenant.template.amended", "payload": {"slug": "test-reseller", "newTemplate": "reseller-onboarding", "delta": {"addedPages": ["partner-dashboard"]}}}'

# Check logs
tail -f website/logs/webhook-dispatch.log
```

## Security Considerations
- Secrets stored encrypted (AES via `secrets` table or direct)
- Signature verification on inbound (for Vercel) and outbound
- Rate limiting on event dispatch
- Payload sanitization (no PII in logs)
- Platform-admin gate only
- CSP and proxy.ts protections

## Integration with Reseller Onboarding
The `tenant.template.amended` event with `newTemplate: "reseller-onboarding"` triggers partner commission setup, additional nav items (`/resellers`, `/commissions`), schema.org `Organization` + `Reseller` markup, and automated onboarding email/webhook to partner network.

## Extending the System
- Add new providers in Zod enum and dispatch mapper
- Register new events in catalog and Inngest
- Add retry queue using Inngest steps
- Webhook delivery dashboard with analytics (success rate, latency)

**Last Updated**: July 2026
**Status**: Production-ready with comprehensive test coverage recommended.
