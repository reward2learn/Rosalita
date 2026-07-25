/**
 * Tenant Provisioning Workflow (Website Stub)
 *
 * The full Inngest workflow lives in the tokenizmyapp orchestrator.
 * This stub exists so the website (tenant app) can import the Inngest
 * client without pulling in orchestrator-only services.
 *
 * When the website is used as the base template for generated tenant apps,
 * the workflow is replaced with tenant-specific logic.
 */

import { inngest } from '@/lib/inngest';

export const provisionTenant = inngest.createFunction(
  {
    id: 'provision-tenant',
    retries: 3,
    triggers: [{ event: 'tenant.created' }],
  },
  async ({ event }) => {
    console.log('[website-stub] Tenant provisioning workflow triggered for:', event.data.slug);
    console.log('[website-stub] This stub does nothing — the real workflow runs in tokenizmyapp');
    return { slug: event.data.slug, stub: true };
  },
);
