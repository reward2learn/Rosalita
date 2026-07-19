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

/**
 * Resolve the OpenAI API base URL.
 * Defaults to https://api.openai.com/v1.
 * Set OPENAI_BASE_URL to point at a local proxy or Ollama (e.g. http://localhost:11434/v1).
 */
export function resolveOpenAiBaseUrl(): string {
  return process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
}
