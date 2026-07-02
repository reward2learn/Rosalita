'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_TTS_VOICE,
  isTtsVoiceId,
  TTS_VOICE_STORAGE_KEY,
  type TtsVoiceId,
} from '@/lib/chat/tts-voices';

export function useTtsVoicePreference(): [TtsVoiceId, (voice: TtsVoiceId) => void] {
  const [voice, setVoiceState] = useState<TtsVoiceId>(DEFAULT_TTS_VOICE);

  useEffect(() => {
    try {
      const stored = globalThis.localStorage?.getItem(TTS_VOICE_STORAGE_KEY);
      if (stored && isTtsVoiceId(stored)) {
        setVoiceState(stored);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const setVoice = useCallback((next: TtsVoiceId) => {
    setVoiceState(next);
    try {
      globalThis.localStorage?.setItem(TTS_VOICE_STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  }, []);

  return [voice, setVoice];
}
