/**
 * POS OCR + parse API — legacy reference: website/api/pos.js
 */
import { NextResponse } from 'next/server';
import { requireWriteAuth } from '@/lib/auth/guards';
import { handlePosParse, handlePosScan } from '@/domain/pos/pos-handlers';
import { handleExpenseParse, handleExpenseScan } from '@/domain/pos/expense-handlers';
import { legacyError } from '@/lib/api/response';

export async function POST(request: Request) {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  let body: Record<string, unknown> = {};
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return legacyError('Invalid JSON body', 400);
  }

  const action = url.searchParams.get('action') || String(body.action || 'parse');

  let result: { status: number; body: Record<string, unknown> };
  switch (action) {
    case 'scan':
      result = await handlePosScan(body);
      break;
    case 'expense-scan':
      result = await handleExpenseScan(body);
      break;
    case 'expense-parse':
      result = await handleExpenseParse(body);
      break;
    default:
      result = await handlePosParse(body);
  }

  return NextResponse.json(result.body, { status: result.status });
}
