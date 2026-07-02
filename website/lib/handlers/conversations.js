/**
 * Saved chat conversations (mounted on /api/chat?resource=conversations).
 */
import { query } from '../db.js';
import { getSession } from '../auth-lib.js';

export async function handleConversations(req, res) {
  const session = await getSession(req);
  const userName = session?.name || session?.email || 'Anonymous';

  if (req.method === 'POST') {
    const { title, messages } = req.body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required and must not be empty' });
    }

    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return res.status(400).json({ error: 'Each message must have role and content' });
      }
    }

    try {
      const result = await query(
        `INSERT INTO conversations (user_name, title, messages, message_count)
         VALUES ($1, $2, $3, $4)
         RETURNING id, created_at`,
        [
          userName,
          (title || 'Chat Conversation').slice(0, 200),
          JSON.stringify(messages),
          messages.length,
        ],
      );

      const saved = result.rows[0];
      return res.status(201).json({
        ok: true,
        id: saved.id,
        created_at: saved.created_at,
      });
    } catch (err) {
      console.error('[conversations] POST error:', err.message);
      return res.status(500).json({ error: 'Failed to save conversation' });
    }
  }

  if (req.method === 'GET') {
    const id = req.query.id;
    if (id) {
      const numId = parseInt(id, 10);
      if (Number.isNaN(numId)) return res.status(400).json({ error: 'Invalid id' });

      try {
        const result = await query(
          `SELECT id, user_name, title, messages, message_count, created_at
           FROM conversations WHERE id = $1`,
          [numId],
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Conversation not found' });

        const row = result.rows[0];
        return res.status(200).json({
          data: {
            id: row.id,
            user_name: row.user_name,
            title: row.title,
            messages: typeof row.messages === 'string' ? JSON.parse(row.messages) : row.messages,
            message_count: row.message_count,
            created_at: row.created_at,
          },
        });
      } catch (err) {
        console.error('[conversations] GET by id error:', err.message);
        return res.status(500).json({ error: 'Failed to load conversation' });
      }
    }

    const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);

    try {
      const result = await query(
        `SELECT id, user_name, title, message_count, created_at
         FROM conversations
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit],
      );
      return res.status(200).json({ data: result.rows });
    } catch (err) {
      console.error('[conversations] GET error:', err.message);
      return res.status(500).json({ error: 'Failed to list conversations' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
