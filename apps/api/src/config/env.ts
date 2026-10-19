import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

/** Charge le premier .env trouvé en remontant depuis le dossier courant (racine du monorepo). */
export function loadEnvFile(start = process.cwd()) {
  let dir = start;
  for (let i = 0; i < 5; i++) {
    const file = path.join(dir, '.env');
    if (fs.existsSync(file)) {
      dotenv.config({ path: file, quiet: true });
      return file;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(3000),
  API_PUBLIC_URL: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().default('postgres://depano:depano@localhost:5432/depano'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(8).default('change-me-access'),
  JWT_REFRESH_SECRET: z.string().min(8).default('change-me-refresh'),
  OTP_PEPPER: z.string().min(8).default('change-me-pepper'),
  /** Clé de chiffrement des données sensibles (code de fin). Dérivée en 32 octets par SHA-256. */
  DATA_ENCRYPTION_KEY: z.string().min(8).optional(),
  SMS_PROVIDER: z.enum(['console', 'twilio']).default('console'),
  APPLE_CLIENT_ID: z.string().default('fr.depano.app'),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  WEBAUTHN_RP_ID: z.string().default('localhost'),
  WEBAUTHN_ORIGINS: z.string().default('http://localhost:3000,http://localhost:8081'),
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  /** Endpoint utilisé dans les URL signées (ex. IP du poste pour un téléphone en dev). */
  S3_PUBLIC_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('fr-par'),
  S3_BUCKET: z.string().default('depano-private'),
  S3_ACCESS_KEY: z.string().default('depano'),
  S3_SECRET_KEY: z.string().default('depano-secret'),
  PAYMENT_PROVIDER: z.enum(['fake', 'stripe']).default('fake'),
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  STRIPE_PUBLISHABLE_KEY: z.string().optional().default(''),
  TWILIO_ACCOUNT_SID: z.string().optional().default(''),
  TWILIO_AUTH_TOKEN: z.string().optional().default(''),
  TWILIO_FROM_NUMBER: z.string().optional().default(''),
  TWILIO_PROXY_SERVICE_SID: z.string().optional().default(''),
  PUSH_PROVIDER: z.enum(['console', 'expo']).default('console'),
  EXPO_ACCESS_TOKEN: z.string().optional().default(''),
  /** Désactive les appels réseau sortants (API adresse, SIRET) : utile en test. */
  OFFLINE_MODE: bool,
  /** Hors production : désactive toute limitation de débit (ignoré en production). */
  RATE_LIMIT_DISABLED: bool,
  /** Hors production : multiplie les plafonds (défaut 20 en développement, 1 en test ; ignoré en production). */
  RATE_LIMIT_MULTIPLIER: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().positive().optional()),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  loadEnvFile();
  const parsed = EnvSchema.safeParse(
    Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, v === '' ? undefined : v])),
  );
  if (!parsed.success) {
    throw new Error(`Configuration invalide : ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join(', ')}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production') {
    for (const k of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'OTP_PEPPER'] as const) {
      if (env[k].startsWith('change-me')) throw new Error(`${k} doit être défini en production`);
    }
  }
  cached = env;
  return env;
}

/** Réservé aux tests : force la relecture de l'environnement. */
export function resetEnvCache() {
  cached = null;
}
