/**
 * Consolidated auth API — single endpoint for auth operations.
 * Google OAuth callback: /api/auth?action=google-callback (also via rewrite from /api/auth/callback/google)
 *
 * GET  /api/auth?action=google           → redirect to Google OAuth
 * GET  /api/auth?action=google-callback  → OAuth code exchange
 * GET  /api/auth?action=me               → check current session
 * GET  /api/auth?action=logout           → clear session
 * GET  /api/auth?action=pdf              → export dashboard PDF (Chromium, auth required)
 * POST /api/auth?action=verify-pin       → verify admin PIN
 * POST /api/auth?action=store-key        → store encrypted secret (requires SETUP_TOKEN)
 */
import { query, getSecret, setSecret } from '../lib/db.js';
import { encrypt, decrypt } from '../lib/crypto.js';
import {
  createSession, setCookie, clearCookie, getSession, getOrigin,
} from '../lib/auth-lib.js';

// ── Handlers ─────────────────────────────────────────

async function handleGoogleRedirect(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    console.error('[auth] GOOGLE_CLIENT_ID not set');
    res.writeHead(302, { Location: '/ops-admin.html?auth=error' });
    return res.end();
  }
  const origin = getOrigin(req);
  // Encode redirect URL in state param: "redirect_url::random_nonce"
  const url = new URL(req.url, origin);
  const redirectTo = url.searchParams.get('redirect') || '/';
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const state = `${redirectTo}::${nonce}`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/callback/google`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
  });
  res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
  res.end();
}

async function handleGoogleCallback(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { code, state, error: oauthError } = req.query;

  let redirectTo = '/';
  if (state && state.includes('::')) {
    redirectTo = state.split('::')[0] || '/';
  }

  if (oauthError || !code) {
    res.writeHead(302, { Location: `${redirectTo}?auth=error` });
    return res.end();
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const origin = getOrigin(req);

  if (!clientId || !clientSecret) {
    console.error('[auth/google-callback] OAuth not configured');
    res.writeHead(302, { Location: `${redirectTo}?auth=error` });
    return res.end();
  }

  try {
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${origin}/api/auth/callback/google`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResp.ok) {
      const errText = await tokenResp.text().catch(() => '');
      console.error('[auth/google-callback] Token exchange failed:', tokenResp.status, errText.slice(0, 200));
      res.writeHead(302, { Location: `${redirectTo}?auth=error` });
      return res.end();
    }

    const tokens = await tokenResp.json();

    const userResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userResp.ok) {
      console.error('[auth/google-callback] Userinfo failed:', userResp.status);
      res.writeHead(302, { Location: `${redirectTo}?auth=error` });
      return res.end();
    }

    const user = await userResp.json();

    const session = await createSession({
      sub: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      authMethod: 'google',
    });

    setCookie(res, session);
    res.writeHead(302, { Location: `${redirectTo}?auth=success` });
    res.end();
  } catch (err) {
    console.error('[auth/google-callback] Error:', err.message);
    res.writeHead(302, { Location: `${redirectTo}?auth=error` });
    res.end();
  }
}

async function handleMe(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const session = await getSession(req);
    return res.status(200).json({
      user: session ? {
        id: session.sub, email: session.email, name: session.name,
        picture: session.picture, authMethod: session.authMethod,
      } : null,
    });
  } catch {
    return res.status(200).json({ user: null });
  }
}

async function handleLogout(req, res) {
  clearCookie(res);
  res.writeHead(302, { Location: '/ops-admin.html' });
  res.end();
}

async function handleVerifyPin(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { pin } = req.body || {};
  if (!pin) return res.status(400).json({ ok: false, error: 'PIN is required' });
  try {
    const secret = await getSecret('ADMIN_PIN');
    if (!secret) return res.status(200).json({ ok: false, error: 'PIN not configured' });
    const stored = decrypt(secret.encrypted, secret.iv, secret.authTag);
    if (!stored || pin.trim() !== stored.trim()) {
      return res.status(200).json({ ok: false, error: 'Incorrect PIN' });
    }
    const session = await createSession({ sub: 'admin', name: 'Admin', authMethod: 'pin' });
    setCookie(res, session);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[auth/verify-pin]', err.message);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}

// ... (lines 1-87 remain unchanged)

async function handlePdf(req, res) {
  const session = await getSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Sign in required to request PDF generation' });
  }
  // --- ARQUITECTURAL CHANGE START: ASYNCHRONOUS JOB QUEUE INITIATION ---
  try {
    const origin = getOrigin(req);
    const sessionCookie = req.headers.cookie || '';
    const pagePath = req.query.page || '/';

    const jobId = await queueJobForPdfGeneration({
      origin,
      sessionId: session.sub,
      sessionCookie,
      pagePath,
    });

    if (!jobId) {
      return res.status(503).json({ error: 'Could not initiate PDF job queue.' });
    } 

    // Respond with 202 Accepted status code and the Job ID for polling later
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(202, { 
      'Content-Type': 'application/json',
      'Retry-After': '60' // Suggest client polls in 60 seconds
    });
    return res.end(JSON.stringify({ 
        message: 'PDF generation job submitted successfully.', 
        jobId: jobId,
        statusCheckUrl: `${origin}/api/vjobs/status/${jobId}` // Link for client to poll status
    }));

  } catch (err) {
    console.error('[auth/pdf]', err.message);
    // Handle specific errors gracefully (Auth Error, Bad Request, etc.)
    return res.status(500).json({ error: 'Internal Server Error while queuing the PDF job.' });
  }
} // <-- The end of function signature for handlePdf

// Removed duplicate handleStoreKey placeholder and added missing queueJobForPdfGeneration implementation

/**
 * Queue a PDF generation job into the persistent job_queue table.
 * @param {{origin:string, sessionId:string}} payload - Information needed to generate the PDF.
 * @returns {Promise<string>} The UUID of the newly created job.
 */
async function queueJobForPdfGeneration({ origin, sessionId, sessionCookie, pagePath }) {
  const result = await query(
    `INSERT INTO job_queue (requested_by_session, payload, status) 
     VALUES ($1, $2::jsonb, 'PENDING') RETURNING job_id;`,
    [sessionId, JSON.stringify({ origin, sessionCookie, pagePath })]
  );
  if (!result || !result.rows[0]) {
    throw new Error('Failed to queue PDF generation job.');
  }
  return result.rows[0].job_id;
}

// Removed stray duplicate declaration of handleStoreKey (lines previously duplicated).

// ── Router ───────────────────────────────────────────
export default async function handler(req, res) {
  const action = req.query.action || '';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  switch (action) {
    case 'google':          return handleGoogleRedirect(req, res);
    case 'google-callback': return handleGoogleCallback(req, res);
    case 'me':              return handleMe(req, res);
    case 'logout':          return handleLogout(req, res);
    case 'pdf':             return req.method === 'GET' ? handlePdf(req, res) : res.status(405).json({ error: 'GET required' });
    case 'verify-pin':      return req.method === 'POST' ? handleVerifyPin(req, res) : res.status(405).json({ error: 'POST required' });
    case 'store-key':       return req.method === 'POST' ? handleStoreKey(req, res) : res.status(405).json({ error: 'POST required' });
    default:
      return res.status(400).json({ error: 'Unknown action', hint: 'Use ?action=google|google-callback|me|logout|pdf|verify-pin|store-key' });
  }
}
