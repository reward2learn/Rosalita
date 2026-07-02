import { getSecret } from './db.js';
import { decrypt } from './crypto.js';

/**
 * Resolve OpenAI API key: DB secrets (encrypted) → OPENAI_API_KEY env.
 */
export async function resolveOpenAiKey() {
  try {
    const secret = await getSecret('OPENAI_API_KEY');
    if (secret) {
      const key = decrypt(secret.encrypted, secret.iv, secret.authTag);
      if (key) return key;
    }
  } catch (e) {
    console.warn('[openai] DB key fetch failed, falling back to env:', e.message);
  }
  return process.env.OPENAI_API_KEY || null;
}
