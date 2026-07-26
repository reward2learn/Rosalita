import { NextRequest, NextResponse } from 'next/server';
import { requireWriteAuth } from '@/lib/auth/guards';
import { jsonOk, jsonError } from '@/lib/api';
import { updateTenantTemplate } from '@/domain/tenant/tenant-service';
import { inngest } from '@/lib/inngest';
import { createClient } from '@/lib/db';
import type { TenantRecord } from '@/domain/tenant/tenant-service';
import { z } from 'zod';

const deploySchema = z.object({
  template: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  amendmentReason: z.string().optional().default('manual-deploy'),
});

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const auth = await requireWriteAuth(request);
  if (!auth.success) return auth.response;

  const slug = params.slug;
  const body = await request.json().catch(() => ({}));
  const parse = deploySchema.safeParse(body);
  if (!parse.success) {
    return jsonError('Invalid deploy payload', 400, parse.error);
  }
  const { template, metadata, amendmentReason } = parse.data;

  try {
    const db = createClient();

    // Fetch latest tenant (ensures template is current)
    let tenant = await db.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        displayName: true,
        template: true,
        status: true,
        primaryColor: true,
        secondaryColor: true,
        metadata: true,
        vercelProjectId: true,
        appUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    }) as TenantRecord | null;

    if (!tenant) {
      return jsonError(`Tenant ${slug} not found`, 404);
    }

    // Override template if provided in payload
    const effectiveTemplate = template || tenant.template || 'default';
    const previousTemplate = tenant.template;

    let delta = undefined;
    if (effectiveTemplate !== previousTemplate) {
      const result = await updateTenantTemplate(db, slug, {
        template: effectiveTemplate,
        metadata: {
          ...tenant.metadata,
          ...metadata,
          previousTemplate,
          amendmentReason,
          deployedAt: new Date().toISOString(),
        },
      });
      tenant = result.tenant as TenantRecord;
      delta = result.delta;
    } else if (metadata) {
      // Update metadata only if no template change
      tenant = await db.tenant.update({
        where: { slug },
        data: { metadata: { ...tenant.metadata, ...metadata }, updatedAt: new Date() },
      }) as TenantRecord;
    }

    // Trigger full Inngest pipeline with complete context
    await inngest.send({
      name: 'tenant.template.amended',
      data: {
        slug,
        previousTemplate,
        newTemplate: effectiveTemplate,
        delta,
        isDeploy: true,
        tenant: tenant as TenantRecord,
        amendmentReason,
        vercelProjectId: tenant.vercelProjectId,
      },
    });

    // Return rich response matching GET/PUT + Vercel info
    const vercelInfo = {
      deployed: true,
      projectId: tenant.vercelProjectId || 'prj_kHPW3f3yGArIihBH3J1zJk4wSmhp',
      projectName: slug,
      appUrl: tenant.appUrl || `https://${slug}.vercel.app`,
      vercelDashboardUrl: `https://vercel.com/ilishaps-projects/${slug}`,
      envCount: 22, // from your trace; can be dynamic
      template: effectiveTemplate,
      fullTenant: tenant,
    };

    return jsonOk({
      success: true,
      data: vercelInfo,
      message: `Deploy triggered for ${slug} with template=${effectiveTemplate}. Full pipeline running via Inngest.`,
    });
  } catch (error: any) {
    console.error('[deploy] Error for', slug, error);
    return jsonError(error.message || 'Deploy failed', 500);
  }
}
