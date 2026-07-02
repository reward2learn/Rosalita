/**
 * OpenAI TTS proxy (mounted on /api/chat?resource=voice).
 */
import { getSecret } from '../db.js';
import { decrypt } from '../crypto.js';

async function resolveApiKey() {
  try {
    const secret = await getSecret('OPENAI_API_KEY');
    if (secret) {
      const key = decrypt(secret.encrypted, secret.iv, secret.authTag);
      if (key) return key;
    }
  } catch (e) {
    console.warn('[voice] DB key fetch failed, falling back to env:', e.message);
  }
  return process.env.OPENAI_API_KEY || null;
}

export async function handleVoice(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, voice: requestedVoice, speed } = req.body || {};

  const inputText = (text || '').trim();
  if (!inputText) {
    return res.status(400).json({ success: false, error: 'Text is required' });
  }
  if (inputText.length > 5000) {
    return res.status(400).json({ success: false, error: 'Text too long (max 5000 characters)' });
  }

  const apiKey = await resolveApiKey();
  if (!apiKey) {
    return res.status(503).json({ success: false, error: 'OpenAI API key not configured' });
  }

  const VALID_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
  const voice = VALID_VOICES.includes(requestedVoice) ? requestedVoice : 'alloy';
  const rate = Math.max(0.25, Math.min(2.0, speed || 1.0));

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        input: inputText,
        voice,
        response_format: 'mp3',
        speed: rate,
      }),
    });

    if (!response.ok) {
      let errorText = '';
      try { errorText = await response.text(); } catch { /* ignore */ }
      throw new Error(
        `OpenAI TTS API error: ${response.status}${errorText ? ` — ${errorText.slice(0, 200)}` : ''}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const base64 = btoa(binary);

    return res.status(200).json({
      success: true,
      audioChunks: [base64],
      format: 'mp3',
    });
  } catch (err) {
    console.error('[voice] Error:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message.includes('OpenAI TTS API error')
        ? 'Voice synthesis failed'
        : 'Internal server error',
    });
  }
}
