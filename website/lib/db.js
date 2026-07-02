/**
 * Database connection helper.
 * Uses @neondatabase/serverless when POSTGRES_URL is configured.
 * Gracefully degrades when no database is available.
 * Auto-creates required tables on first runtime connect (not during next build).
 */

let _sql = null;
let _ready = false;
let _migrated = false;

function isBuildPhase() {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

function isNeonRetryable(err) {
  const msg = err?.message ?? String(err);
  return msg.includes('neon:retryable') || msg.includes('Control plane request failed');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn, { attempts = 3, baseMs = 500 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isNeonRetryable(err) || i === attempts - 1) throw err;
      const delay = baseMs * (i + 1);
      console.warn(`[db] Transient Neon error, retry ${i + 1}/${attempts - 1} in ${delay}ms…`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

async function connectDb() {
  if (_ready) return true;
  if (_sql === false) return false;
  if (_sql !== null) return _ready;

  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.log('[db] No POSTGRES_URL — DB disabled');
    _sql = false;
    return false;
  }

  try {
    const { neon } = await import('@neondatabase/serverless');
    _sql = neon(connectionString);
    _ready = true;
    console.log('[db] Connected');
    return true;
  } catch (err) {
    console.warn('[db] Init failed:', err.message);
    _sql = false;
    return false;
  }
}

async function ensureDb() {
  if (isBuildPhase()) return false;

  const connected = await connectDb();
  if (connected && !_migrated) {
    await migrate();
    _migrated = true;
  }
  return _ready;
}

/** Explicit migration entry point for `bun run db:migrate` / seed scripts. */
export async function runMigrations() {
  const connected = await connectDb();
  if (!connected) {
    throw new Error('POSTGRES_URL is not set or connection failed');
  }
  await migrate();
  _migrated = true;
}

async function migrate() {
  try {
    await withRetry(async () => {
    await _sql(`
      CREATE TABLE IF NOT EXISTS secrets (
        key_name TEXT PRIMARY KEY,
        encrypted_value TEXT NOT NULL,
        iv TEXT NOT NULL,
        auth_tag TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[db] Secrets table ready');

await _sql(`
       CREATE TABLE IF NOT EXISTS conversations (
         id SERIAL PRIMARY KEY,
         user_name TEXT DEFAULT 'Anonymous',
         title TEXT DEFAULT 'Chat Conversation',
         messages JSONB NOT NULL DEFAULT '[]'::jsonb,
         message_count INTEGER DEFAULT 0,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       );
     `);
     console.log('[db] Conversations table ready');

     // ---- Job Queue Table (persistent for async tasks) ----
     await _sql(`
       CREATE TABLE IF NOT EXISTS job_queue (
         job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         requested_by_session TEXT,
         payload JSONB NOT NULL,
         status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
         created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
         updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
         completed_data JSONB
       );
     `);
      await _sql(`CREATE INDEX IF NOT EXISTS idx_job_queue_by_status ON job_queue (status);`);

      // ---- Financial Projections Table (from Excel P&L) ----
      await _sql(`
        CREATE TABLE IF NOT EXISTS financial_projections (
          id SERIAL PRIMARY KEY,
          period TEXT NOT NULL,
          year INTEGER NOT NULL,
          month INTEGER NOT NULL,
          data_type TEXT NOT NULL,
          scenario TEXT NOT NULL DEFAULT 'conservative',
          revenue NUMERIC(14,2) DEFAULT 0,
          ebitda NUMERIC(14,2) DEFAULT 0,
          net_income NUMERIC(14,2) DEFAULT 0,
          guests INTEGER DEFAULT 0,
          staff_cost NUMERIC(14,2) DEFAULT 0,
          UNIQUE(period, data_type, scenario)
        );
      `);
      // Migration: add scenario column if missing, set defaults
      try { await _sql(`ALTER TABLE financial_projections ADD COLUMN IF NOT EXISTS scenario TEXT NOT NULL DEFAULT 'conservative';`); } catch(e) {}
      try { await _sql(`UPDATE financial_projections SET scenario = 'actual' WHERE data_type = 'actual' AND scenario = 'conservative';`); } catch(e) {}
      try { await _sql(`UPDATE financial_projections SET scenario = 'conservative' WHERE data_type = 'forecast' AND scenario = 'actual';`); } catch(e) {}
      // Drop old unique constraint if it exists (before scenario column was added)
      try { await _sql(`ALTER TABLE financial_projections DROP CONSTRAINT IF EXISTS financial_projections_period_data_type_key;`); } catch(e) {}
      // Recreate unique constraint to include scenario (ignore if already exists)
      try { await _sql(`ALTER TABLE financial_projections ADD CONSTRAINT financial_projections_period_data_type_scenario_key UNIQUE (period, data_type, scenario);`); } catch(e) {}
      try { await _sql(`ALTER TABLE financial_projections ADD COLUMN IF NOT EXISTS pnl_lines JSONB;`); } catch(e) {}
      await _sql(`CREATE INDEX IF NOT EXISTS idx_financial_projections_period ON financial_projections (period);`);

      // ---- Daily Z Sales Reports (POS printout) ----
      await _sql(`
        CREATE TABLE IF NOT EXISTS daily_z_reports (
          id SERIAL PRIMARY KEY,
          report_date DATE NOT NULL,
          department TEXT NOT NULL DEFAULT 'all_pos',
          report_time TIME,
          operator TEXT,
          report_no INTEGER,
          pos_group TEXT,
          period_start TIMESTAMP,
          period_end TIMESTAMP,
          item_sales_qty INTEGER DEFAULT 0,
          item_sales_amount NUMERIC(14,2) DEFAULT 0,
          item_discount_qty INTEGER DEFAULT 0,
          item_discount_amount NUMERIC(14,2) DEFAULT 0,
          bill_discount_qty INTEGER DEFAULT 0,
          bill_discount_amount NUMERIC(14,2) DEFAULT 0,
          foc_items_qty INTEGER DEFAULT 0,
          foc_items_amount NUMERIC(14,2) DEFAULT 0,
          foc_bill_qty INTEGER DEFAULT 0,
          foc_bill_amount NUMERIC(14,2) DEFAULT 0,
          total_sales NUMERIC(14,2) DEFAULT 0,
          estimated_sales NUMERIC(14,2) DEFAULT 0,
          cash_qty INTEGER DEFAULT 0,
          cash_amount NUMERIC(14,2) DEFAULT 0,
          bca_qty INTEGER DEFAULT 0,
          bca_amount NUMERIC(14,2) DEFAULT 0,
          gojek_pay_qty INTEGER DEFAULT 0,
          gojek_pay_amount NUMERIC(14,2) DEFAULT 0,
          mandiri_qty INTEGER DEFAULT 0,
          mandiri_amount NUMERIC(14,2) DEFAULT 0,
          total_card_qty INTEGER DEFAULT 0,
          total_card_amount NUMERIC(14,2) DEFAULT 0,
          total_cash_qty INTEGER DEFAULT 0,
          total_cash_amount NUMERIC(14,2) DEFAULT 0,
          refund_qty INTEGER DEFAULT 0,
          refund_amount NUMERIC(14,2) DEFAULT 0,
          pre_send_void_qty INTEGER DEFAULT 0,
          pre_send_void_amount NUMERIC(14,2) DEFAULT 0,
          post_send_void_qty INTEGER DEFAULT 0,
          post_send_void_amount NUMERIC(14,2) DEFAULT 0,
          tot_collection_qty INTEGER DEFAULT 0,
          tot_collection_amount NUMERIC(14,2) DEFAULT 0,
          tax_10_amount NUMERIC(14,2) DEFAULT 0,
          service_7_amount NUMERIC(14,2) DEFAULT 0,
          nett_sales NUMERIC(14,2) DEFAULT 0,
          bills_pending_qty INTEGER DEFAULT 0,
          bills_pending_amount NUMERIC(14,2) DEFAULT 0,
          total_bills INTEGER DEFAULT 0,
          avg_bills NUMERIC(14,2) DEFAULT 0,
          total_covers INTEGER DEFAULT 0,
          avg_covers NUMERIC(14,2) DEFAULT 0,
          begin_receipt_no TEXT,
          end_receipt_no TEXT,
          group_beverage_qty INTEGER DEFAULT 0,
          group_beverage_amount NUMERIC(14,2) DEFAULT 0,
          group_food_qty INTEGER DEFAULT 0,
          group_food_amount NUMERIC(14,2) DEFAULT 0,
          group_total_qty INTEGER DEFAULT 0,
          group_total_amount NUMERIC(14,2) DEFAULT 0,
          group_foc_beverage_qty INTEGER DEFAULT 0,
          group_foc_beverage_amount NUMERIC(14,2) DEFAULT 0,
          group_foc_food_qty INTEGER DEFAULT 0,
          group_foc_food_amount NUMERIC(14,2) DEFAULT 0,
          dine_in_qty INTEGER DEFAULT 0,
          dine_in_amount NUMERIC(14,2) DEFAULT 0,
          gofood_qty INTEGER DEFAULT 0,
          gofood_amount NUMERIC(14,2) DEFAULT 0,
          total_ctgry_qty INTEGER DEFAULT 0,
          total_ctgry_amount NUMERIC(14,2) DEFAULT 0,
          bill_disc_20_qty INTEGER DEFAULT 0,
          bill_disc_20_amount NUMERIC(14,2) DEFAULT 0,
          total_item_discount_qty INTEGER DEFAULT 0,
          total_item_discount_amount NUMERIC(14,2) DEFAULT 0,
          raw_text TEXT,
          entry_source TEXT NOT NULL DEFAULT 'manual',
          receipt_images JSONB DEFAULT '[]'::jsonb,
          corrected_at TIMESTAMP,
          correction_field TEXT,
          correction_reason TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      try {
        await _sql(`ALTER TABLE daily_z_reports ADD COLUMN IF NOT EXISTS entry_source TEXT NOT NULL DEFAULT 'manual';`);
      } catch (e) {}
      try {
        await _sql(`ALTER TABLE daily_z_reports ADD COLUMN IF NOT EXISTS receipt_images JSONB DEFAULT '[]'::jsonb;`);
      } catch (e) {}
      try {
        await _sql(`ALTER TABLE daily_z_reports ADD COLUMN IF NOT EXISTS corrected_at TIMESTAMP;`);
      } catch (e) {}
      try {
        await _sql(`ALTER TABLE daily_z_reports ADD COLUMN IF NOT EXISTS correction_field TEXT;`);
      } catch (e) {}
      try {
        await _sql(`ALTER TABLE daily_z_reports ADD COLUMN IF NOT EXISTS correction_reason TEXT;`);
      } catch (e) {}
      try {
        await _sql(`ALTER TABLE daily_z_reports ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT 'all_pos';`);
      } catch (e) {}
      try {
        await _sql(`ALTER TABLE daily_z_reports DROP CONSTRAINT IF EXISTS daily_z_reports_report_date_key;`);
      } catch (e) {}
      try {
        await _sql(`CREATE UNIQUE INDEX IF NOT EXISTS daily_z_reports_date_dept_key ON daily_z_reports (report_date, department);`);
      } catch (e) {}
      console.log('[db] daily_z_reports table ready');

      await _sql(`
        CREATE TABLE IF NOT EXISTS monthly_actual_inputs (
          period TEXT PRIMARY KEY,
          inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('[db] monthly_actual_inputs table ready');

      await _sql(`
        CREATE TABLE IF NOT EXISTS monthly_actual_departments (
          period TEXT NOT NULL,
          department TEXT NOT NULL,
          inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
          receipt_images JSONB NOT NULL DEFAULT '[]'::jsonb,
          notes TEXT DEFAULT '',
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (period, department)
        );
      `);
      console.log('[db] monthly_actual_departments table ready');
    });
  } catch (err) {
    console.warn('[db] Migration note:', err.message);
  }
}

export async function query(text, params) {
  await ensureDb();
  if (!_ready) return { rows: [] };
  try {
    const result = await _sql(text, params);
    return { rows: result };
  } catch (err) {
    console.error('[db] Query error:', err.message);
    return { rows: [] };
  }
}

export async function isReady() {
  await ensureDb();
  return _ready;
}

/**
 * Retrieve an encrypted secret from the database.
 * Returns { encrypted, iv, authTag } or null if not found.
 */
export async function getSecret(keyName) {
  await ensureDb();
  if (!_ready) return null;
  try {
    const rows = await _sql`SELECT encrypted_value, iv, auth_tag FROM secrets WHERE key_name = ${keyName}`;
    if (rows.length === 0) return null;
    return {
      encrypted: rows[0].encrypted_value,
      iv: rows[0].iv,
      authTag: rows[0].auth_tag,
    };
  } catch (err) {
    console.error('[db] getSecret error:', err.message);
    return null;
  }
}

/**
 * Store an encrypted secret in the database (upsert).
 */
export async function setSecret(keyName, encryptedValue, iv, authTag) {
  await ensureDb();
  if (!_ready) throw new Error('Database not ready');
  await _sql`
    INSERT INTO secrets (key_name, encrypted_value, iv, auth_tag, updated_at)
    VALUES (${keyName}, ${encryptedValue}, ${iv}, ${authTag}, CURRENT_TIMESTAMP)
    ON CONFLICT (key_name)
    DO UPDATE SET encrypted_value = ${encryptedValue}, iv = ${iv}, auth_tag = ${authTag}, updated_at = CURRENT_TIMESTAMP
  `;
}
