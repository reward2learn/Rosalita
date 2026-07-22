/**
 * Tests for the /api/chat/update-review route — schema validation.
 */
import { describe, it, expect } from 'vitest';

// Replicate the Zod schema inline to test validation logic
import { z } from 'zod';

const reviewUpdateSchema = z.object({
  messages: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })).min(1),
  summary: z.string().min(1),
  target: z.enum(['review', 'executive_summary']).optional(),
});

describe('/api/chat/update-review schema', () => {
  it('accepts valid review update payload', () => {
    const result = reviewUpdateSchema.safeParse({
      messages: [{ role: 'assistant', content: 'New analysis data...' }],
      summary: 'Update part-a with new revenue figures',
    });
    expect(result.success).toBe(true);
  });

  it('accepts executive_summary target', () => {
    const result = reviewUpdateSchema.safeParse({
      messages: [{ role: 'assistant', content: 'Executive update...' }],
      summary: 'Update executive summary with Q3 data',
      target: 'executive_summary',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.target).toBe('executive_summary');
    }
  });

  it('rejects empty messages', () => {
    const result = reviewUpdateSchema.safeParse({
      messages: [],
      summary: 'test',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing summary', () => {
    const result = reviewUpdateSchema.safeParse({
      messages: [{ role: 'assistant', content: 'test' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid target value', () => {
    const result = reviewUpdateSchema.safeParse({
      messages: [{ role: 'assistant', content: 'test' }],
      summary: 'test',
      target: 'invalid_target',
    });
    expect(result.success).toBe(false);
  });
});
