import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
export const hmac = (secret: string, v: string) => createHmac('sha256', secret).update(v).digest('hex');

export function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export const randomDigits = (length: number) => Array.from({ length }, () => randomInt(0, 10)).join('');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

const key = (secret: string) => createHash('sha256').update(secret).digest();

/** AES-256-GCM : iv(12) | tag(16) | données, en base64url. */
export function encrypt(secret: string, plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}

export function decrypt(secret: string, payload: string): string | null {
  try {
    const buf = Buffer.from(payload, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key(secret), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

const REF_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const bookingReference = () => `DEP-${Array.from({ length: 6 }, () => REF_ALPHABET[randomInt(0, REF_ALPHABET.length)]).join('')}`;
