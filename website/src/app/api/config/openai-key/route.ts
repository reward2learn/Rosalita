import { z } from 'zod';
import { requireWriteAuth } from '@/lib/auth/guards';
import { jsonError, jsonOk } from '@/lib/api/response';
import {
  deleteSecret,
  getOpenAiKeyStatus,
  setSecret,
} from '@/lib/secrets';

const bodySchema = z.object({
  apiKey: z.string().trim().min(20, 'API key is too short'),
});

export async function GET(request: Request) {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const status = await getOpenAiKeyStatus();
  return jsonOk(status);
}

export async function POST(request: Request) {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid API key', 400);
  }

  await setSecret('OPENAI_API_KEY', parsed.data.apiKey);
  const status = await getOpenAiKeyStatus();
  return jsonOk(status);
}

export async function DELETE(request: Request) {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  await deleteSecret('OPENAI_API_KEY');
  const status = await getOpenAiKeyStatus();
  return jsonOk(status);
}
