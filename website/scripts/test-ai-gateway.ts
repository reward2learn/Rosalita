/**
 * AI Gateway verification script.
 * Tests that the AI Gateway is configured correctly by streaming a response
 * from openai/gpt-5.5 via the Vercel AI SDK.
 *
 * Usage: cd website && npx tsx scripts/test-ai-gateway.ts
 */
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local from the project root (one level up from website/)
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY;
const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL;

console.log('');
console.log('=== AI Gateway Verification ===');
console.log('AI_GATEWAY_API_KEY:', AI_GATEWAY_API_KEY ? `✅ Set (${AI_GATEWAY_API_KEY.slice(0, 12)}...)` : '❌ Not set');
console.log('AI_GATEWAY_URL:', AI_GATEWAY_URL ?? '⚠️  Not set (using default)');
console.log('');

async function main() {
  try {
    console.log('Calling streamText with model "openai/gpt-5.5"...');
    console.log('');

    const result = streamText({
      model: openai('gpt-5.5'),
      prompt: 'Say "Hello from AI Gateway!" in exactly one short sentence.',
    });

    let fullResponse = '';
    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
      fullResponse += chunk;
    }

    console.log('\n');
    console.log('✅ AI Gateway is working!');
    console.log(`Full response: "${fullResponse.trim()}"`);
    console.log('');
  } catch (err) {
    console.error('❌ AI Gateway test failed:', err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) {
      console.error('Stack:', err.stack.split('\n').slice(0, 5).join('\n'));
    }
    process.exit(1);
  }
}

main();
