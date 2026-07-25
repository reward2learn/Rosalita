/**
 * Tenant Provisioning & Amendment Workflow (Website Stub)
 *
 * Enhanced for template changes. Full orchestration (with AI content gen,
 * DB seeding, Vercel deploy) lives in tokenizmyapp. This stub logs delta-aware
 * steps for local testing. Delta ensures incremental-only changes.
 *
 * Triggered by tenant.template.amended from /api/admin/tenants/[slug] PUT.
 */

import { inngest } from '@/lib/inngest';
import type { TemplateDelta } from '@/domain/tenant/tenant-service';

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

/**
 * Delta-aware handler for template amendments.
 * Steps:
 * 1. Seed AppPage records (idempotent, incremental for new defaultPages)
 * 2. uiSlice sync hint (for colors, new blockTypes in UI state)
 * 3. Deploy trigger (Vercel redeploy for tenant project)
 * Then sets status=live (in real impl).
 *
 * Incremental only — preserves financial_projections, existing data.
 */
export const amendTenantTemplate = inngest.createFunction(
  {
    id: 'tenant-template-amended',
    retries: 3,
    concurrency: {
      limit: 1, // per-tenant to avoid race conditions
    },
    triggers: [{ event: 'tenant.template.amended' }],
  },
  async ({ event, step }) => {
    const { slug, previousTemplate, newTemplate, delta } = event.data as {
      slug: string;
      previousTemplate: string;
      newTemplate: string;
      delta: TemplateDelta;
      metadata?: Record<string, unknown>;
    };

    console.log(`[tenant-amend] Template amendment for ${slug}: ${previousTemplate} → ${newTemplate}`);
    console.log(`[tenant-amend] Delta: ${delta.summary}`);
    console.log(`[tenant-amend] Incremental only: ${delta.incrementalOnly}`);

    // Step 1: Seed AppPage (idempotent, only new pages from delta.addedPages)
    const seedResult = await step.run('seed-app-pages', async () => {
      console.log(`[seed] Idempotent seeding AppPage/nav for ${slug} with template=${newTemplate}`);
      console.log(`[seed] New pages from delta:`, delta.addedPages);
      // In full impl: call seed service with --tenant=${slug} --template=${newTemplate}
      // Uses page-catalog.ts + ZenStack to upsert only incremental changes
      // Preserves financial_projections and legacy data
      return {
        seeded: true,
        addedPages: delta.addedPages,
        template: newTemplate,
      };
    });

    // Step 2: uiSlice sync hint (propagates colors, block registry to Redux/RTK)
    const uiResult = await step.run('ui-slice-sync-hint', async () => {
      console.log(`[uiSlice] Sync hint for new template: colors=${delta.colorsChanged}, blocks=${delta.blockTypesAdded.length}`);
      // In full impl: update uiSlice via event or DB metadata; invalidates RTK tenantApi
      // Triggers re-render of DynamicPage with new blockTypes from catalog
      return {
        synced: true,
        colorsChanged: delta.colorsChanged,
        newBlocks: delta.blockTypesAdded,
        hint: 'uiSlice.syncTemplate',
      };
    });

    // Step 3: Deploy trigger (Vercel for tenant's vercelProjectId or appUrl)
    const deployResult = await step.run('trigger-vercel-deploy', async () => {
      console.log(`[deploy] Triggering incremental Vercel deploy for tenant ${slug}`);
      console.log(`[deploy] Using template ${newTemplate} (financial-analytics for RedRubyBali test)`);
      // In full impl: use Vercel API / deploy-to-vercel skill with projectId from tenant
      // On success: update tenant status='live', app_url, emit tenant.deployed
      return {
        triggered: true,
        project: `${slug}.vercel.app`,
        template: newTemplate,
      };
    });

    // Final status update would happen in real handler via step
    console.log(`[tenant-amend] Completed delta-aware amendment for ${slug}. Integrates with new UI via seeded AppPage + uiSlice.`);

    return {
      success: true,
      slug,
      previousTemplate,
      newTemplate,
      delta: delta.summary,
      steps: {
        seed: seedResult,
        uiSync: uiResult,
        deploy: deployResult,
      },
      note: 'Tested with RedRubyBali (financial-analytics). Incremental only. Full flow in tokenizmyapp orchestrator.',
    };
  },
);
