import { z } from 'zod';
import { requireWriteAuth } from '@/lib/auth/guards';
import { jsonError, jsonOk } from '@/lib/api/response';
import { createClient } from '@/lib/db';
import { getAppSettings, updateAppSettings } from '@/domain/config/app-settings-service';

const patchSchema = z.object({
  webSearchEnabled: z.boolean(),
});

export async function GET(request: Request) {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const db = createClient({
    tier: guard.session.tier,
    ...(guard.session.sub !== undefined ? { sub: guard.session.sub } : {}),
  });

  const settings = await getAppSettings(db);
  return jsonOk({
    webSearchEnabled: settings.webSearchEnabled,
    updatedAt: settings.updatedAt.toISOString(),
  });
}

export async function PATCH(request: Request) {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('webSearchEnabled boolean is required', 400);
  }

  const db = createClient({
    tier: guard.session.tier,
    ...(guard.session.sub !== undefined ? { sub: guard.session.sub } : {}),
  });

  const settings = await updateAppSettings(db, {
    webSearchEnabled: parsed.data.webSearchEnabled,
  });

  return jsonOk({
    webSearchEnabled: settings.webSearchEnabled,
    updatedAt: settings.updatedAt.toISOString(),
  });
}
