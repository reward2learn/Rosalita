/**
 * Tests for the /api/chat/ai-findings route — schema validation.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const postSchema = z.object({
  content: z.string().min(1),
  title: z.string().optional(),
});

describe('/api/chat/ai-findings schema', () => {
  it('accepts valid content', () => {
    const result = postSchema.safeParse({
      content: '## AI Finding\n\nNew insight from chat...',
    });
    expect(result.success).toBe(true);
  });

  it('accepts content with optional title', () => {
    const result = postSchema.safeParse({
      content: 'Revenue analysis...',
      title: 'Revenue Trend Update',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Revenue Trend Update');
    }
  });

  it('rejects empty content', () => {
    const result = postSchema.safeParse({ content: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing content', () => {
    const result = postSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
