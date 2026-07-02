/**
 * Store encrypted secret via SETUP_TOKEN bearer (setup-only).
 */
import { z } from 'zod';
import { setSecret } from '@/lib/secrets';

const storeKeyBodySchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
});

export interface StoreKeyResult {
  success: boolean;
  key?: string;
  error?: string;
}

export async function handleStoreKey(request: Request): Promise<StoreKeyResult> {
  const auth = request.headers.get('authorization') ?? '';
  const token = process.env.SETUP_TOKEN;
  if (!token || auth !== `Bearer ${token}`) {
    return { success: false, error: 'Unauthorized — SETUP_TOKEN bearer required' };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { success: false, error: 'Invalid JSON body' };
  }

  const parsed = storeKeyBodySchema.safeParse(body);
  if (!parsed.success) {
    return { success: false, error: 'Body must include key and value strings' };
  }

  try {
    await setSecret(parsed.data.key, parsed.data.value);
    return { success: true, key: parsed.data.key };
  } catch (err) {
    console.error('[store-key]', err);
    return { success: false, error: 'Failed to store secret' };
  }
}
