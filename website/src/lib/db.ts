/**
 * ZenStack DB client — policy-aware Prisma via enhance().
 * Do not use dotenv/config here; POSTGRES_URL must be set by the host (Vercel / vercel dev).
 */
import { PrismaClient } from '@/generated/prisma';
import { enhance } from '@zenstackhq/runtime';

export interface DbSession {
  tier: 'public' | 'pin' | 'google';
  sub?: string;
}

/** Policy-aware client; avoid Enhanced<> which hits TS recursion limits with Auth. */
export type DbClient = ReturnType<typeof createClient>;

const globalForPrisma = globalThis as typeof globalThis & {
  __redrubyPrisma?: PrismaClient;
};

function getPostgresUrl(): string {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    throw new Error('POSTGRES_URL is not set');
  }
  return url;
}

function getBasePrisma(): PrismaClient {
  if (!globalForPrisma.__redrubyPrisma) {
    globalForPrisma.__redrubyPrisma = new PrismaClient({
      datasources: { db: { url: getPostgresUrl() } },
    });
  }
  return globalForPrisma.__redrubyPrisma;
}

/** Request-scoped ZenStack client; pass session tier for @@allow policies. */
export function createClient(session: DbSession = { tier: 'public' }) {
  const prisma = getBasePrisma();
  return enhance(prisma, {
    user: {
      id: session.sub ?? session.tier,
      tier: session.tier,
      ...(session.sub !== undefined ? { sub: session.sub } : {}),
    },
  });
}

/**
 * Internal client for bootstrap/migration and security-account operations.
 * Uses a public-tier enhanced client; raw queries ($queryRawUnsafe /
 * $executeRawUnsafe) bypass ZenStack policy filtering, so DDL, account upserts,
 * and admin reads always succeed regardless of the caller's session.
 */
export function createBaseClient(): DbClient {
  return createClient({ tier: 'public' });
}
