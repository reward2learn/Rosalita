export const TTS_VOICE_IDS = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;

export type TtsVoiceId = (typeof TTS_VOICE_IDS)[number];

export const DEFAULT_TTS_VOICE: TtsVoiceId = 'alloy';

export const TTS_VOICE_STORAGE_KEY = 'redruby.ttsVoice';

export interface TtsVoiceProfile {
  id: TtsVoiceId;
  label: string;
  description: string;
}

export const TTS_VOICE_PROFILES: TtsVoiceProfile[] = [
  { id: 'alloy', label: 'Alloy', description: 'Neutral and balanced' },
  { id: 'echo', label: 'Echo', description: 'Warm and conversational' },
  { id: 'fable', label: 'Fable', description: 'Expressive and clear' },
  { id: 'onyx', label: 'Onyx', description: 'Deep and authoritative' },
  { id: 'nova', label: 'Nova', description: 'Friendly and upbeat' },
  { id: 'shimmer', label: 'Shimmer', description: 'Soft and bright' },
];

export function isTtsVoiceId(value: string): value is TtsVoiceId {
  return (TTS_VOICE_IDS as readonly string[]).includes(value);
}

export function resolveTtsVoice(value: string | null | undefined): TtsVoiceId {
  return value && isTtsVoiceId(value) ? value : DEFAULT_TTS_VOICE;
}
