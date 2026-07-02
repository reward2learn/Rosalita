import { getSecretPlaintext } from '@/lib/secrets';

/** Resolve OpenAI API key: DB secrets (encrypted) → OPENAI_API_KEY env. */
export async function resolveOpenAiKey(): Promise<string | null> {
  try {
    const key = await getSecretPlaintext('OPENAI_API_KEY');
    if (key) return key;
  } catch (err) {
    console.warn('[openai] DB key fetch failed, falling back to env:', err instanceof Error ? err.message : err);
  }
  return process.env.OPENAI_API_KEY ?? null;
}
