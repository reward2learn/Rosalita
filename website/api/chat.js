import { query, isReady, getSecret } from '../lib/db.js';
import { decrypt } from '../lib/crypto.js';
import { buildSystemPrompt, MONTHLY_TARGETS } from '../lib/knowledge-base.js';
import { handleVoice } from '../lib/handlers/voice.js';
import { handleConversations } from '../lib/handlers/conversations.js';

/**
 * POST /api/chat                              — AI chat (optional stream)
 * POST /api/chat?resource=voice               — OpenAI TTS proxy
 * GET|POST /api/chat?resource=conversations   — saved conversations
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const resource = req.query.resource;
  if (resource === 'voice') return handleVoice(req, res);
  if (resource === 'conversations') return handleConversations(req, res);

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, history = [], stream } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // 1) Detect if the question needs database data
    const needsDb = detectDatabaseQuery(message);

    let dbContext = '';
    if (needsDb && isReady()) {
      dbContext = await fetchDatabaseContext(message);
    }

    // 2) Build messages
    const systemPrompt = buildSystemPrompt();

    const messages = [
      { role: 'system', content: systemPrompt },
    ];

    // Conversation history (last 6)
    for (const msg of history.slice(-6)) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Database context
    if (dbContext) {
      messages.push({
        role: 'system',
        content: `[DATABASE QUERY RESULT — Current actuals from the database]\n${dbContext}\n\nUse this data to answer the user's question. Compare against the targets you already know in the knowledge base. If the database has no data yet, explain that and suggest using the Ops Admin page to start entering daily metrics.`,
      });
    }

    messages.push({ role: 'user', content: message });

    // 3) Resolve OpenAI API key: DB (encrypted) → env var (fallback)
    const apiKey = await resolveApiKey();
    if (!apiKey) {
      return res.status(200).json({
        reply: 'I\'m not fully configured yet. The owner needs to add an **OpenAI API key** in the Vercel environment variables. Once that\'s done, I can:\n\n' +
               '- Answer questions about the business review and turnaround plan\n' +
               '- Query the database for actual vs target performance\n' +
               '- Track KPIs and highlight areas needing attention\n\n' +
               'In the meantime, you can still explore the **Dashboard**, **Summary**, and **Analysis** pages.',
      });
    }

    const chatResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages,
        max_tokens: 1200,
        temperature: 0.7,
        stream: stream === true,
      }),
    });

    if (!chatResp.ok) {
      const errText = await chatResp.text();
      console.error('OpenAI API error:', chatResp.status, errText.slice(0, 200));
      const errReply = chatResp.status === 401
        ? 'The OpenAI API key appears to be invalid. Please check the OPENAI_API_KEY environment variable.'
        : chatResp.status === 429
          ? 'The AI service is currently rate-limited (out of credits or too many requests). Please try again later.'
          : 'The AI service returned an error. Please try again.';

      if (stream) {
        // Send error as SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write(`data: ${JSON.stringify({ error: errReply })}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
      }
      return res.status(200).json({ reply: errReply });
    }

    // ── Streaming path ──
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const reader = chatResp.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { res.end(); break; }
          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);
        }
      } catch (err) {
        console.error('[chat] Stream pipe error:', err.message);
        if (!res.writableEnded) res.end();
      }
      return;
    }

    // ── Non-streaming path (fallback) ──
    const data = await chatResp.json();
    const reply = data.choices?.[0]?.message?.content
      || 'I could not generate a response. Please try rephrasing your question.';

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('CHAT ERROR:', err);

    let reply;
    if (err.status === 401 || (err.message && err.message.includes('401'))) {
      reply = 'The OpenAI API key is invalid or has insufficient credits. Please check the OPENAI_API_KEY environment variable in Vercel.';
    } else {
      reply = 'I encountered an error processing your request. Please try again in a moment.';
    }

    return res.status(200).json({ reply });
  }
}

/**
 * Resolve the OpenAI API key from:
 * 1. Secrets table in DB (encrypted, preferred)
 * 2. Vercel env var OPENAI_API_KEY (fallback for migration)
 * Returns null if neither is available.
 */
async function resolveApiKey() {
  // Try DB first (encrypted storage)
  try {
    const secret = await getSecret('OPENAI_API_KEY');
    if (secret) {
      const key = decrypt(secret.encrypted, secret.iv, secret.authTag);
      if (key) return key;
    }
  } catch (e) {
    console.warn('[chat] DB key fetch failed, falling back to env:', e.message);
  }
  // Fallback to env var
  return process.env.OPENAI_API_KEY || null;
}

function detectDatabaseQuery(message) {
  const dbKeywords = [
    'actual', 'current', 'tracking', 'kpi', 'performance',
    'how are we', 'how did we', 'what was', 'what were',
    'revenue', 'ebitda', 'guests', 'covers', 'staff cost',
    'trend', 'compare', 'vs target', 'vs projection',
    'month to date', 'mtd', 'ytd', 'last month', 'this month',
    'progress', 'on track', 'behind', 'ahead',
    'show me', 'numbers', 'data', 'report', 'daily metrics',
    'weekly', 'monthly', 'average spend', 'avg spend',
    'spend per guest', ' performance',
  ];
  const lower = message.toLowerCase();
  return dbKeywords.some(k => lower.includes(k));
}

async function fetchDatabaseContext(message) {
  const parts = [];

  // Recent daily entries
  try {
    const recent = await query(
      'SELECT report_date AS date, nett_sales AS revenue, total_covers AS guests_count, avg_covers AS avg_spend, total_bills, gofood_amount, dine_in_amount, tot_collection_amount, total_sales, tax_10_amount, service_7_amount FROM daily_z_reports ORDER BY report_date DESC LIMIT 7'
    );
    if (recent.rows.length > 0) {
      parts.push('=== RECENT DAILY DATA (last 7 entries) ===');
      parts.push('date | nett_sales | covers | avg_covers | bills | gofood | dine_in | collection');
      for (const r of recent.rows) {
        parts.push(`${r.date} | ${Number(r.revenue).toLocaleString()} | ${r.guests_count} | ${r.avg_spend ? Number(r.avg_spend).toLocaleString() : '-'} | ${r.total_bills || '-'} | ${r.gofood_amount ? Number(r.gofood_amount).toLocaleString() : '-'} | ${r.dine_in_amount ? Number(r.dine_in_amount).toLocaleString() : '-'} | ${r.tot_collection_amount ? Number(r.tot_collection_amount).toLocaleString() : '-'}`);
      }
    }
  } catch (e) {
    // ignore
  }

  // Current month aggregate
  try {
    const currentMonth = await query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', report_date), 'YYYY-MM') AS month,
        SUM(nett_sales) AS total_revenue,
        COUNT(*) AS days_count,
        ROUND(AVG(total_covers)) AS avg_guests,
        ROUND(AVG(avg_covers)) AS avg_spend,
        SUM(gofood_amount) AS total_gofood,
        SUM(dine_in_amount) AS total_dine_in
      FROM daily_z_reports
      WHERE DATE_TRUNC('month', report_date) = DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY DATE_TRUNC('month', report_date)
    `);
    if (currentMonth.rows.length > 0) {
      const cm = currentMonth.rows[0];
      parts.push('\n=== CURRENT MONTH (POS Z-reports) ===');
      parts.push(`Month: ${cm.month}, Days: ${cm.days_count}`);
      parts.push(`Nett Sales: ${Number(cm.total_revenue).toLocaleString()}`);
      parts.push(`Avg Covers/Day: ${cm.avg_guests}`);
      parts.push(`Avg Spend: ${Number(cm.avg_spend).toLocaleString()}`);
      parts.push(`GoFood: ${Number(cm.total_gofood).toLocaleString()}, Dine-in: ${Number(cm.total_dine_in).toLocaleString()}`);

      const target = MONTHLY_TARGETS.find(t => t.month === cm.month);
      if (target) {
        const projRev = (Number(cm.total_revenue) / cm.days_count) * 30;
        parts.push('--- VS TARGET ---');
        parts.push(`Target Revenue: ${Number(target.revenue).toLocaleString()}, Projected: ${Math.round(projRev).toLocaleString()}`);
        parts.push(`Target Guests/Day: ${target.guests}, Actual: ${cm.avg_guests}`);
        parts.push(`Target Avg Spend: ${Number(target.spend).toLocaleString()}, Actual: ${Number(cm.avg_spend).toLocaleString()}`);
      }
    }
  } catch (e) {
    // ignore
  }

  // Weekly trend (last 4 weeks)
  try {
    const weekData = await query(`
      SELECT 
        DATE_TRUNC('week', report_date)::date AS week_start,
        SUM(nett_sales) AS total_revenue,
        SUM(total_covers) AS total_guests
      FROM daily_z_reports
      WHERE DATE_TRUNC('week', report_date) >= DATE_TRUNC('week', CURRENT_DATE - INTERVAL '4 weeks')
      GROUP BY DATE_TRUNC('week', report_date)
      ORDER BY week_start DESC
    `);
    if (weekData.rows.length > 1) {
      parts.push('\n=== WEEKLY TREND ===');
      for (const w of weekData.rows) {
        parts.push(`${w.week_start} | Nett Sales: ${Number(w.total_revenue).toLocaleString()} | Covers: ${w.total_guests}`);
      }
    }
  } catch (e) {
    // ignore
  }

  // Monthly data this year
  try {
    const monthly = await query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', report_date), 'YYYY-MM') AS month,
        SUM(nett_sales) AS total_revenue,
        SUM(total_covers) AS total_guests
      FROM daily_z_reports
      WHERE DATE_TRUNC('year', report_date) = DATE_TRUNC('year', CURRENT_DATE)
      GROUP BY DATE_TRUNC('month', report_date)
      ORDER BY month ASC
    `);
    if (monthly.rows.length > 0) {
      parts.push('\n=== MONTHLY THIS YEAR (POS) ===');
      for (const m of monthly.rows) {
        const t = MONTHLY_TARGETS.find(x => x.month === m.month);
        const targetNote = t ? `(target rev: ${Number(t.revenue).toLocaleString()})` : '(no target)';
        parts.push(`${m.month}: Nett Sales ${Number(m.total_revenue).toLocaleString()} ${targetNote}, Covers ${m.total_guests}`);
      }
    }
  } catch (e) {
    // ignore
  }

  if (parts.length === 0) {
    parts.push('(No data in database yet — no daily metrics have been entered. Start by entering data on the Ops Admin page.)');
  }

  return parts.join('\n');
}
