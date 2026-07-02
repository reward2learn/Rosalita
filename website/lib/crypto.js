/**
 * AES-256-GCM encrypt / decrypt for API key storage.
 * Master key loaded from ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
 */

import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // bytes

function getMasterKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) throw new Error('ENCRYPTION_KEY not set');
  return Buffer.from(hex.trim(), 'hex');
}

/**
 * Encrypt a plaintext string.
 * @returns {{ encrypted: string, iv: string, authTag: string }}
 */
export function encrypt(text) {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return { encrypted, iv: iv.toString('hex'), authTag };
}

/**
 * Decrypt an encrypted value.
 * @param {string} encrypted - hex ciphertext
 * @param {string} iv - hex IV
 * @param {string} authTag - hex auth tag
 * @returns {string} plaintext
 */
export function decrypt(encrypted, iv, authTag) {
  const key = getMasterKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  let plain = decipher.update(encrypted, 'hex', 'utf8');
  plain += decipher.final('utf8');
  return plain;
}
