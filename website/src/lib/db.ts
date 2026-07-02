/**
 * ZenStack DB client — policy-aware Prisma via enhance().
 * Do not use dotenv/config here; POSTGRES_URL must be set by the host (Vercel / vercel dev).
 */
import { PrismaClient } from '@/generated/prisma';
import {
  enhance,
  type Enhanced,
  type PrismaClient as ZenPrismaClient,
} from '@zenstackhq/runtime';

export interface DbSession {
  tier: 'public' | 'pin' | 'google';
  sub?: string;
}

export type DbClient = Enhanced<ZenPrismaClient>;

const globalForPrisma = globalThis as typeof globalThis & {
  __rosalitaPrisma?: PrismaClient;
};

function getPostgresUrl(): string {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    throw new Error('POSTGRES_URL is not set');
  }
  return url;
}

function getBasePrisma(): PrismaClient {
  if (!globalForPrisma.__rosalitaPrisma) {
    globalForPrisma.__rosalitaPrisma = new PrismaClient({
      datasources: { db: { url: getPostgresUrl() } },
    });
  }
  return globalForPrisma.__rosalitaPrisma;
}

/** Request-scoped ZenStack client; pass session tier for future @@allow policies. */
export function createClient(session: DbSession = { tier: 'public' }): DbClient {
  const prisma = getBasePrisma();
  return enhance(prisma, {
    user: {
      tier: session.tier,
      ...(session.sub !== undefined ? { sub: session.sub } : {}),
    },
  }) as DbClient;
}
