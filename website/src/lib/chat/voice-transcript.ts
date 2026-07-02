export const VOICE_DEBOUNCE_MS = 2000;

export interface SpeechResultSegment {
  transcript: string;
  isFinal: boolean;
}

export function fullTranscriptFromResults(
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>,
): { display: string; hasSpeech: boolean } {
  let finalText = '';
  let interimText = '';
  for (let i = 0; i < results.length; i += 1) {
    const transcript = results[i][0].transcript;
    if (results[i].isFinal) finalText += transcript;
    else interimText += transcript;
  }
  const display = finalText + interimText;
  return {
    display,
    hasSpeech: Boolean(finalText.trim() || interimText.trim()),
  };
}

/** Read only recognition segments added since a prior flush (keeps one mic session alive). */
export function transcriptFromResultOffset(
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>,
  startIndex: number,
): { display: string; hasSpeech: boolean; resultCount: number } {
  if (!results.length) {
    return { display: '', hasSpeech: false, resultCount: 0 };
  }

  let safeStart = Math.max(0, startIndex);
  if (safeStart >= results.length) {
    safeStart = 0;
  }
  let finalText = '';
  let interimText = '';
  for (let i = safeStart; i < results.length; i += 1) {
    const transcript = results[i][0].transcript;
    if (results[i].isFinal) finalText += transcript;
    else interimText += transcript;
  }
  const display = finalText + interimText;
  return {
    display,
    hasSpeech: Boolean(finalText.trim() || interimText.trim()),
    resultCount: results.length,
  };
}
