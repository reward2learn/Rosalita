export interface MicrophoneCheckResult {
  ok: boolean;
  message: string;
}

export async function checkMicrophoneAccess(): Promise<MicrophoneCheckResult> {
  if (typeof globalThis.navigator === 'undefined') {
    return { ok: false, message: 'Microphone access is not available in this environment.' };
  }

  const mediaDevices = globalThis.navigator.mediaDevices;
  if (!mediaDevices?.getUserMedia) {
    return { ok: false, message: 'This browser does not support microphone access.' };
  }

  try {
    const stream = await mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) {
      track.stop();
    }
    return { ok: true, message: '' };
  } catch (err) {
    if (err instanceof DOMException) {
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        return {
          ok: false,
          message: 'No microphone was found on this system. Connect a microphone or check your device settings, then try again.',
        };
      }
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        return {
          ok: false,
          message: 'Microphone permission was blocked. Allow microphone access in your browser settings, then try again.',
        };
      }
      if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        return {
          ok: false,
          message: 'The microphone could not be opened. It may be in use by another app or unavailable on this device.',
        };
      }
    }

    return {
      ok: false,
      message: 'Could not access the microphone. Check your device and browser permissions, then try again.',
    };
  }
}

export function microphoneErrorMessage(errorCode: string | undefined): string {
  switch (errorCode) {
    case 'audio-capture':
      return 'No microphone is available on this system. Connect a microphone or check your device settings, then try again.';
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone permission was blocked. Allow microphone access in your browser settings, then try again.';
    case 'not-found':
      return 'No microphone was found on this system. Connect a microphone, then try again.';
    case 'network':
      return 'Voice input lost its network connection. Check your connection and try again.';
    case 'language-not-supported':
      return 'Voice input is not supported for this language on your device.';
    default:
      return 'Voice input could not use the microphone. Check your device and browser permissions, then try again.';
  }
}

/** Errors that should not stop voice mode or show a dialog. */
export function isBenignRecognitionError(errorCode: string | undefined): boolean {
  return !errorCode || errorCode === 'no-speech' || errorCode === 'aborted';
}
