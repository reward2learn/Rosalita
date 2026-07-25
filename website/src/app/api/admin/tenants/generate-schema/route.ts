/**
 * POST /api/admin/tenants/generate-schema
 *
 * Generates a W3C-aligned ZenStack schema from a natural language prompt.
 * Uses the Vercel AI SDK via AI Gateway.
 */

import { NextResponse } from 'next/server';
import { requireWriteAuth } from '@/lib/auth/guards';
import { jsonError, jsonOk } from '@/lib/api/response';
import { generateSchemaFromPrompt, mockGenerateSchema } from '@/domain/ai/schema-generator';
import { compileToZModel, compileToPageCatalog } from '@/domain/ai/zmodel-compiler';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  let body: { prompt?: string; templateId?: string; mock?: boolean };
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  if (!body.templateId) {
    return jsonError('templateId is required', 400);
  }

  // Support mock mode for testing without AI API calls
  if (body.mock) {
    const mockSchema = mockGenerateSchema(body.templateId);
    const mockZmodel = compileToZModel(mockSchema);
    const mockPageCatalog = compileToPageCatalog(mockSchema);
    return jsonOk({
      schema: mockSchema,
      zmodel: mockZmodel,
      pageCatalog: mockPageCatalog,
      modelCount: mockSchema.models.length,
      useCaseCount: mockSchema.useCases.length,
      pageCount: mockSchema.pages.length,
      mock: true,
    });
  }

  if (!body.prompt) {
    return jsonError('prompt is required (or set mock=true for testing)', 400);
  }

  try {
    const schema = await generateSchemaFromPrompt(body.prompt, body.templateId);
    const zmodel = compileToZModel(schema);
    const pageCatalog = compileToPageCatalog(schema);

    return jsonOk({
      schema,
      zmodel,
      pageCatalog,
      modelCount: schema.models.length,
      useCaseCount: schema.useCases.length,
      pageCount: schema.pages.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[generate-schema] Error:', msg);
    if (err instanceof Error && err.stack) {
      console.error('[generate-schema] Stack:', err.stack.split('\n').slice(0, 5).join('\n'));
    }
    return jsonError(`Schema generation failed: ${msg.slice(0, 200)}`, 500);
  }
}
