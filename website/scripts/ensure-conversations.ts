/**
 * Ensure conversations table exists with all required columns.
 * Run with: bun run scripts/ensure-conversations.ts
 */
import { createClient } from '../src/lib/db';
import { ensureConversationsColumns } from '../src/lib/db-migrate';

async function main() {
  if (!process.env.POSTGRES_URL) {
    console.error('[ensure-conversations] POSTGRES_URL is not set.');
    process.exit(1);
  }

  const db = createClient();
  try {
    // First check if table exists and has data
    try {
      const count = await db.conversation.count();
      console.log(`[ensure-conversations] Current conversations: ${count}`);
    } catch {
      console.log('[ensure-conversations] Table does not exist — creating...');
    }

    const ok = await ensureConversationsColumns(db);
    console.log(`[ensure-conversations] ${ok ? '✅ Done' : '❌ Failed'}`);
  } catch (err) {
    console.error('[ensure-conversations] Error:', err);
    process.exit(1);
  }
}

main();
