import { createClient } from '@/lib/db';
import { decrypt, encrypt } from '@/lib/crypto';

export interface SecretRecord {
  encrypted: string;
  iv: string;
  authTag: string;
}

export async function getSecret(keyName: string): Promise<SecretRecord | null> {
  try {
    const db = createClient();
    const row = await db.secret.findUnique({ where: { keyName } });
    if (!row) return null;
    return {
      encrypted: row.encryptedValue,
      iv: row.iv,
      authTag: row.authTag,
    };
  } catch (err) {
    console.error('[secrets] getSecret error:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function setSecret(keyName: string, plaintext: string): Promise<void> {
  const { encrypted, iv, authTag } = encrypt(plaintext);
  const db = createClient();
  await db.secret.upsert({
    where: { keyName },
    create: { keyName, encryptedValue: encrypted, iv, authTag },
    update: { encryptedValue: encrypted, iv, authTag },
  });
}

export async function getSecretPlaintext(keyName: string): Promise<string | null> {
  const secret = await getSecret(keyName);
  if (!secret) return null;
  try {
    return decrypt(secret.encrypted, secret.iv, secret.authTag);
  } catch {
    return null;
  }
}

export async function deleteSecret(keyName: string): Promise<void> {
  const db = createClient();
  await db.secret.deleteMany({ where: { keyName } });
}

export async function getOpenAiKeyStatus(): Promise<{
  configured: boolean;
  source: 'db' | 'env' | null;
}> {
  const dbRow = await getSecret('OPENAI_API_KEY');
  if (dbRow) return { configured: true, source: 'db' };
  if (process.env.OPENAI_API_KEY) return { configured: true, source: 'env' };
  return { configured: false, source: null };
}
