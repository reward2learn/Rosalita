/**
 * Bootstrap legacy tables not auto-created by legacy lib/db.js migrate.
 * Safe to run multiple times (IF NOT EXISTS).
 *
 * Apply schema changes via ZenStack:
 *   cd website && npx zenstack generate --schema zenstack/schema.zmodel
 *   npx prisma db push --schema src/generated/prisma/schema.prisma
 *
 * Requires POSTGRES_URL. Do NOT run destructive migrations against production
 * without explicit approval and a verified backup.
 */
import type { DbClient } from '@/lib/db';

const DAILY_METRICS_DDL = `
CREATE TABLE IF NOT EXISTS daily_metrics (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  guests_count INTEGER NOT NULL DEFAULT 0,
  avg_spend NUMERIC(10,2),
  staff_count INTEGER NOT NULL DEFAULT 0,
  staff_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  food_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  beverage_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  gofood_revenue NUMERIC(12,2) DEFAULT 0,
  direct_orders NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;

const MONTHLY_TARGETS_DDL = `
CREATE TABLE IF NOT EXISTS monthly_targets (
  id SERIAL PRIMARY KEY,
  month TEXT NOT NULL UNIQUE,
  target_revenue NUMERIC(12,2) NOT NULL,
  target_ebitda NUMERIC(12,2) NOT NULL,
  target_guests INTEGER NOT NULL,
  target_avg_spend NUMERIC(10,2) NOT NULL,
  target_staff_cost_pct NUMERIC(5,2) NOT NULL
);`;

const JOB_QUEUE_DDL = `
DO $$ BEGIN
  CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS job_queue (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by_session TEXT,
  payload JSONB NOT NULL,
  status "JobStatus" NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_data JSONB
);

CREATE INDEX IF NOT EXISTS idx_job_queue_by_status ON job_queue (status);
`;

function isNeonRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('neon:retryable') || msg.includes('Control plane request failed');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseMs = 500): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isNeonRetryable(err) || i === attempts - 1) throw err;
      const delay = baseMs * (i + 1);
      console.warn(`[db-migrate] Transient Neon error, retry ${i + 1}/${attempts - 1} in ${delay}ms…`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

export async function ensureJobQueueTable(db: DbClient): Promise<boolean> {
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is not set — refusing to run ensureJobQueueTable');
  }

  await withRetry(async () => {
    await db.$executeRawUnsafe(JOB_QUEUE_DDL);
  });

  return true;
}

export async function ensureLegacyTables(db: DbClient): Promise<{ daily_metrics: boolean; monthly_targets: boolean; job_queue: boolean }> {
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is not set — refusing to run ensureLegacyTables');
  }

  await withRetry(async () => {
    await db.$executeRawUnsafe(DAILY_METRICS_DDL);
    await db.$executeRawUnsafe(MONTHLY_TARGETS_DDL);
    await db.$executeRawUnsafe(JOB_QUEUE_DDL);
  });

  return { daily_metrics: true, monthly_targets: true, job_queue: true };
}

export const MIGRATION_NOTES = `
ZenStack migration workflow (website/):
1. Edit zenstack/schema.zmodel (SSoT)
2. npm run zen:generate
3. npx prisma db push --schema src/generated/prisma/schema.prisma  (dev only)
4. Call ensureLegacyTables(createClient()) for daily_metrics + monthly_targets if missing

Maps:
  DailyMetric   -> daily_metrics
  MonthlyTarget -> monthly_targets

Never drop production tables. Use introspection-aligned @@map names only.
`.trim();
