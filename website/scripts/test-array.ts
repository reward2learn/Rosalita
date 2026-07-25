import { PrismaClient } from '../src/generated/prisma';

async function main() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  console.log('URL prefix:', url?.substring(0, 20));
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  
  try {
    // Try inserting with array parameter
    const result = await prisma.$executeRawUnsafe(
      `INSERT INTO security_groups (code, name, description, is_system, permissions)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (code) DO UPDATE SET name = $2, description = $3, is_system = $4, permissions = $5`,
      'test-group', 'Test', 'test', false, ['*']
    );
    console.log('✅ Array INSERT result:', result);
    
    // Clean up
    await prisma.$executeRawUnsafe(`DELETE FROM security_groups WHERE code = 'test-group'`);
    console.log('✅ Cleaned up');
  } catch (err) {
    console.error('❌ ERROR:', err);
    process.exit(1);
  }
  
  await prisma.$disconnect();
}

main();
