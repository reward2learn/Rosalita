export interface SpeechRecognitionAlternative {
  transcript: string;
}
export interface SpeechRecognitionResult {
  0: SpeechRecognitionAlternative;
  isFinal: boolean;
}
export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResult>;
}
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
}
export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof globalThis === 'undefined') return null;
  const w = globalThis as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function segmentsFromSpeechEvent(event: SpeechRecognitionEventLike) {
  const segments = [];
  for (let i = event.resultIndex; i < event.results.length; i += 1) {
    segments.push({
      transcript: event.results[i][0].transcript,
      isFinal: event.results[i].isFinal,
    });
  }
  return segments;
}
