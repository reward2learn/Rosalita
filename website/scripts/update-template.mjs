// One-off script: update redrubybali tenant_template to ecommerce-retail
import { PrismaClient } from '../src/generated/prisma/index.js';
import { readFileSync } from 'fs';
import { parse } from 'dotenv';

// Load env
const envRaw = readFileSync('.env.local', 'utf-8');
const env = parse(envRaw);
const POSTGRES_URL = env.POSTGRES_URL || process.env.POSTGRES_URL;

if (!POSTGRES_URL) {
  console.error('POSTGRES_URL not found');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url: POSTGRES_URL } },
});

try {
  // Update app_settings
  await prisma.$executeRawUnsafe(`
    INSERT INTO app_settings (id, tenant_slug, tenant_template, updated_at)
    VALUES ('redrubybali', 'redrubybali', 'ecommerce-retail', NOW())
    ON CONFLICT (id) DO UPDATE SET
      tenant_template = 'ecommerce-retail',
      updated_at = NOW()
  `);
  console.log('✅ Set tenant_template to ecommerce-retail');

  // Verify
  const rows = await prisma.$queryRawUnsafe(`SELECT tenant_template FROM app_settings WHERE id = 'redrubybali'`);
  console.log('  Row:', JSON.stringify(rows));

  console.log('Done! Navigation will seed on next GET /api/navigation');
} catch (err) {
  console.error('Failed:', err);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
