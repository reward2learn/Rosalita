import { describe, expect, it } from 'vitest';
import { fullTranscriptFromResults, transcriptFromResultOffset, VOICE_DEBOUNCE_MS } from '@/lib/chat/voice-transcript';

describe('voice-transcript', () => {
  it('uses a 2 second debounce constant', () => {
    expect(VOICE_DEBOUNCE_MS).toBe(2000);
  });

  it('merges final and interim segments into display text', () => {
    const results = [
      { 0: { transcript: 'hello ' }, isFinal: true },
      { 0: { transcript: 'world' }, isFinal: true },
      { 0: { transcript: ' again' }, isFinal: false },
    ];
    const result = fullTranscriptFromResults(results);
    expect(result.display).toBe('hello world again');
    expect(result.hasSpeech).toBe(true);
  });

  it('reports no speech for empty segments', () => {
    const result = fullTranscriptFromResults([{ 0: { transcript: '   ' }, isFinal: false }]);
    expect(result.hasSpeech).toBe(false);
  });

  it('reads only segments after a flushed offset', () => {
    const results = [
      { 0: { transcript: 'old message ' }, isFinal: true },
      { 0: { transcript: 'new ' }, isFinal: true },
      { 0: { transcript: 'speech' }, isFinal: false },
    ];
    const result = transcriptFromResultOffset(results, 1);
    expect(result.display).toBe('new speech');
    expect(result.hasSpeech).toBe(true);
    expect(result.resultCount).toBe(3);
  });

  it('clamps offset when the results buffer was reset', () => {
    const results = [{ 0: { transcript: 'fresh speech' }, isFinal: false }];
    const result = transcriptFromResultOffset(results, 8);
    expect(result.display).toBe('fresh speech');
    expect(result.hasSpeech).toBe(true);
  });
});
