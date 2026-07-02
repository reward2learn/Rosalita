/**
 * POST /api/pos?action=scan  — OCR receipt images → text
 * POST /api/pos?action=parse — parse receipt text → Z fields
 */
import { handlePosScan, handlePosParse } from '../lib/handlers/pos.js';
import { handleExpenseScan, handleExpenseParse } from '../lib/handlers/expense-receipt.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || req.body?.action || 'parse';
  if (action === 'scan') return handlePosScan(req, res);
  if (action === 'expense-scan') return handleExpenseScan(req, res);
  if (action === 'expense-parse') return handleExpenseParse(req, res);
  return handlePosParse(req, res);
}
