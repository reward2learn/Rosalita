'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getSpeechRecognitionCtor,
  type SpeechRecognitionLike,
} from '@/lib/chat/speech-recognition';
import { transcriptFromResultOffset, VOICE_DEBOUNCE_MS } from '@/lib/chat/voice-transcript';
import {
  checkMicrophoneAccess,
  isBenignRecognitionError,
  microphoneErrorMessage,
} from '@/lib/chat/check-microphone';

export type VoicePhase = 'off' | 'listening' | 'processing' | 'speaking';

const STREAMING_TTS_MIN_CHARS = 40;
const STREAMING_TTS_SOFT_LIMIT = 180;
const SENTENCE_END_PATTERN = /[.!?]\s+|\n{2,}/g;
const DEFAULT_ASSISTANT_VOLUME = 0.85;
const VOLUME_STORAGE_KEY = 'rosalita.assistantVoiceVolume';
const MUTE_STORAGE_KEY = 'rosalita.assistantVoiceMuted';
const RECOGNITION_RESTART_MS = 250;
const RAPID_RESTART_WINDOW_MS = 800;
const MAX_RAPID_RESTARTS = 3;

function extractSpeakablePrefix(text: string, isFinal: boolean): string {
  if (isFinal) return text;
  if (text.trim().length < STREAMING_TTS_MIN_CHARS) return '';

  SENTENCE_END_PATTERN.lastIndex = 0;
  let sentenceEnd = 0;
  let match = SENTENCE_END_PATTERN.exec(text);
  while (match) {
    sentenceEnd = match.index + match[0].length;
    match = SENTENCE_END_PATTERN.exec(text);
  }
  if (sentenceEnd >= STREAMING_TTS_MIN_CHARS) {
    return text.slice(0, sentenceEnd);
  }

  if (text.length < STREAMING_TTS_SOFT_LIMIT) return '';

  const searchWindow = text.slice(0, STREAMING_TTS_SOFT_LIMIT);
  const fallbackEnd = Math.max(
    searchWindow.lastIndexOf(', '),
    searchWindow.lastIndexOf('; '),
    searchWindow.lastIndexOf(': '),
    searchWindow.lastIndexOf(' '),
  );

  return fallbackEnd >= STREAMING_TTS_MIN_CHARS ? text.slice(0, fallbackEnd + 1) : '';
}

interface SynthesizeVoiceResult {
  data?: {
    audioChunks?: string[];
    format?: string;
  };
}

interface UseVoiceConversationOptions {
  isStreaming: boolean;
  lastAssistantText: string | undefined;
  onTranscriptChange: (text: string) => void;
  onSend: (message: string) => Promise<void>;
  synthesizeVoice: (args: { text: string }) => Promise<SynthesizeVoiceResult>;
}

export function useVoiceConversation({
  isStreaming,
  lastAssistantText,
  onTranscriptChange,
  onSend,
  synthesizeVoice,
}: UseVoiceConversationOptions) {
  const [voiceMode, setVoiceMode] = useState(false);
  const [voicePhase, setVoicePhase] = useState<VoicePhase>('off');
  const [sttSupported, setSttSupported] = useState(true);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voicePaused, setVoicePaused] = useState(false);
  const [assistantMuted, setAssistantMuted] = useState(false);
  const [assistantVolume, setAssistantVolumeState] = useState(DEFAULT_ASSISTANT_VOLUME);
  const [micUnavailableMessage, setMicUnavailableMessage] = useState<string | null>(null);

  const voiceModeRef = useRef(false);
  const voicePausedRef = useRef(false);
  const micUnavailableRef = useRef(false);
  const voicePhaseRef = useRef<VoicePhase>('off');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const pendingTranscriptRef = useRef('');
  const flushedResultsLengthRef = useRef(0);
  const lastResultsLengthRef = useRef(0);
  const isStreamingRef = useRef(isStreaming);
  const isSendingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const lastSpokenRef = useRef('');
  const restartTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const prevVoiceModeRef = useRef(false);
  const playbackSettleRef = useRef<((interrupted: boolean) => void) | null>(null);
  const startRecognitionRef = useRef<() => void>(() => {});
  const speechQueueRef = useRef<string[]>([]);
  const speechQueueRunningRef = useRef(false);
  const assistantMutedRef = useRef(false);
  const assistantVolumeRef = useRef(DEFAULT_ASSISTANT_VOLUME);
  const rapidRestartCountRef = useRef(0);

  const setPhase = useCallback((phase: VoicePhase) => {
    voicePhaseRef.current = phase;
    setVoicePhase(phase);
  }, []);

  const updatePhaseFromActivity = useCallback(() => {
    if (!voiceModeRef.current || voicePausedRef.current) {
      setPhase('off');
      return;
    }
    if (isSpeakingRef.current) {
      setPhase('speaking');
      return;
    }
    if (isStreamingRef.current || isSendingRef.current) {
      setPhase('processing');
      return;
    }
    setPhase('listening');
  }, [setPhase]);

  const ensureListening = useCallback(() => {
    if (!voiceModeRef.current || voicePausedRef.current || micUnavailableRef.current) return;
    if (!recognitionRef.current) {
      startRecognitionRef.current();
    }
  }, []);

  const clearDebounce = useCallback(() => {
    if (debounceTimerRef.current) {
      globalThis.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      globalThis.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    speechQueueRef.current = [];
    ttsAbortRef.current?.abort();
    ttsAbortRef.current = null;

    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      try {
        URL.revokeObjectURL(audioUrlRef.current);
      } catch {
        // ignore
      }
      audioUrlRef.current = null;
    }

    playbackSettleRef.current?.(true);
    playbackSettleRef.current = null;

    isSpeakingRef.current = false;
    setIsSpeaking(false);
    if (voiceModeRef.current && !voicePausedRef.current) {
      updatePhaseFromActivity();
    }
  }, [updatePhaseFromActivity]);

  const stopRecognition = useCallback(() => {
    clearRestartTimer();
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (!recognition) return;
    try {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.onspeechstart = null;
      recognition.stop();
    } catch {
      try {
        recognition.abort();
      } catch {
        // ignore
      }
    }
  }, [clearRestartTimer]);

  const flushTranscript = useCallback(async () => {
    clearDebounce();
    const trimmed = pendingTranscriptRef.current.trim();
    if (!trimmed || voicePausedRef.current || isSendingRef.current) return;

    isSendingRef.current = true;
    pendingTranscriptRef.current = '';
    flushedResultsLengthRef.current = lastResultsLengthRef.current;
    onTranscriptChange('');
    updatePhaseFromActivity();

    try {
      await onSend(trimmed);
    } finally {
      isSendingRef.current = false;
      updatePhaseFromActivity();
    }
  }, [clearDebounce, onSend, onTranscriptChange, updatePhaseFromActivity]);

  const scheduleDebounce = useCallback(() => {
    if (!pendingTranscriptRef.current.trim()) return;
    clearDebounce();
    debounceTimerRef.current = globalThis.setTimeout(() => {
      debounceTimerRef.current = null;
      void flushTranscript();
    }, VOICE_DEBOUNCE_MS);
  }, [clearDebounce, flushTranscript]);

  const handleMicUnavailable = useCallback((message: string) => {
    micUnavailableRef.current = true;
    voiceModeRef.current = false;
    voicePausedRef.current = false;
    rapidRestartCountRef.current = 0;
    setVoiceMode(false);
    setVoicePaused(false);
    clearDebounce();
    clearRestartTimer();
    stopRecognition();
    stopSpeaking();
    pendingTranscriptRef.current = '';
    flushedResultsLengthRef.current = 0;
    lastResultsLengthRef.current = 0;
    onTranscriptChange('');
    setVoiceStatus(null);
    setPhase('off');
    setMicUnavailableMessage(message);
  }, [clearDebounce, clearRestartTimer, onTranscriptChange, setPhase, stopRecognition, stopSpeaking]);

  const dismissMicUnavailableDialog = useCallback(() => {
    micUnavailableRef.current = false;
    setMicUnavailableMessage(null);
  }, []);

  const startRecognition = useCallback(() => {
    if (!voiceModeRef.current || voicePausedRef.current || micUnavailableRef.current) {
      return;
    }

    if (recognitionRef.current) {
      updatePhaseFromActivity();
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSttSupported(false);
      handleMicUnavailable('Voice input is not supported in this browser. Try Chrome or Edge on desktop.');
      return;
    }

    stopRecognition();
    setVoiceStatus(null);

    // A new browser recognition session starts with a fresh results buffer.
    flushedResultsLengthRef.current = 0;
    lastResultsLengthRef.current = 0;

    const recognition = new Ctor();
    const startedAt = Date.now();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onspeechstart = () => {
      if (isSpeakingRef.current) {
        stopSpeaking();
      }
    };

    recognition.onresult = (event) => {
      lastResultsLengthRef.current = event.results.length;

      let startIndex = flushedResultsLengthRef.current;
      if (event.results.length < startIndex) {
        startIndex = 0;
        flushedResultsLengthRef.current = 0;
      }

      const merged = transcriptFromResultOffset(event.results, startIndex);
      if (!merged.display.trim()) return;

      pendingTranscriptRef.current = merged.display;
      onTranscriptChange(merged.display);

      if (merged.hasSpeech && isSpeakingRef.current) {
        stopSpeaking();
      }

      if (merged.hasSpeech) {
        rapidRestartCountRef.current = 0;
      }

      scheduleDebounce();
    };

    recognition.onerror = (event) => {
      if (isBenignRecognitionError(event.error)) return;
      handleMicUnavailable(microphoneErrorMessage(event.error));
    };

    recognition.onend = () => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      if (!voiceModeRef.current || voicePausedRef.current || micUnavailableRef.current) return;

      const sessionDuration = Date.now() - startedAt;
      if (sessionDuration < RAPID_RESTART_WINDOW_MS) {
        rapidRestartCountRef.current += 1;
        if (rapidRestartCountRef.current >= MAX_RAPID_RESTARTS) {
          handleMicUnavailable(
            'Voice input keeps stopping. Check your microphone and browser permissions, then try again.',
          );
          return;
        }
      } else {
        rapidRestartCountRef.current = 0;
      }

      clearRestartTimer();
      restartTimerRef.current = globalThis.setTimeout(() => {
        restartTimerRef.current = null;
        if (voiceModeRef.current && !voicePausedRef.current && !micUnavailableRef.current) {
          startRecognitionRef.current();
        }
      }, RECOGNITION_RESTART_MS);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      updatePhaseFromActivity();
    } catch {
      handleMicUnavailable('Could not start voice input. Check that a microphone is connected and allowed in your browser.');
      recognitionRef.current = null;
    }
  }, [
    handleMicUnavailable,
    onTranscriptChange,
    scheduleDebounce,
    stopRecognition,
    stopSpeaking,
    clearRestartTimer,
    updatePhaseFromActivity,
  ]);

  startRecognitionRef.current = startRecognition;

  const playSpeechChunk = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return false;

    const abortController = new AbortController();
    ttsAbortRef.current = abortController;

    try {
      const payload = await synthesizeVoice({ text: trimmed });
      if (abortController.signal.aborted) return;

      const firstChunk = payload.data?.audioChunks?.[0];
      if (!firstChunk) {
        setVoiceStatus('Voice synthesis is unavailable right now.');
        return false;
      }

      const format = payload.data?.format ?? 'mp3';
      const binary = globalThis.atob(firstChunk);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: `audio/${format}` });
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;

      const audio = new globalThis.Audio(url);
      audio.volume = assistantMutedRef.current ? 0 : assistantVolumeRef.current;
      audioRef.current = audio;

      const interrupted = await new Promise<boolean>((resolve, reject) => {
        const cleanup = () => {
          audio.removeEventListener('ended', onEnded);
          audio.removeEventListener('error', onError);
        };
        const onEnded = () => {
          playbackSettleRef.current = null;
          cleanup();
          resolve(false);
        };
        const onError = () => {
          playbackSettleRef.current = null;
          cleanup();
          reject(new Error('Audio playback failed'));
        };
        playbackSettleRef.current = (wasInterrupted) => {
          playbackSettleRef.current = null;
          cleanup();
          resolve(wasInterrupted);
        };
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);
        void audio.play().catch(reject);
      });

      if (interrupted || abortController.signal.aborted) return;
      return true;
    } catch (err) {
      if (!abortController.signal.aborted) {
        setVoiceStatus(err instanceof Error ? err.message : 'Could not play the spoken reply.');
      }
      return false;
    } finally {
      playbackSettleRef.current = null;
      if (ttsAbortRef.current === abortController) {
        ttsAbortRef.current = null;
      }
      if (audioUrlRef.current) {
        try {
          URL.revokeObjectURL(audioUrlRef.current);
        } catch {
          // ignore
        }
        audioUrlRef.current = null;
      }
      audioRef.current = null;
    }
  }, [synthesizeVoice]);

  const processSpeechQueue = useCallback(async () => {
    if (speechQueueRunningRef.current || voicePausedRef.current || assistantMutedRef.current) return;
    speechQueueRunningRef.current = true;
    isSpeakingRef.current = true;
    setIsSpeaking(true);
    updatePhaseFromActivity();

    try {
      while (speechQueueRef.current.length) {
        const nextText = speechQueueRef.current.shift();
        if (!nextText) continue;
        if (voicePausedRef.current || assistantMutedRef.current) break;
        const ok = await playSpeechChunk(nextText);
        if (!ok && ttsAbortRef.current === null) break;
      }
    } finally {
      speechQueueRunningRef.current = false;
      if (speechQueueRef.current.length) {
        void processSpeechQueue();
      } else {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
      }

      updatePhaseFromActivity();
      ensureListening();
    }
  }, [ensureListening, playSpeechChunk, updatePhaseFromActivity]);

  const queueSpeech = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || voicePausedRef.current || assistantMutedRef.current) return;
    speechQueueRef.current.push(trimmed);
    void processSpeechQueue();
  }, [processSpeechQueue]);

  const speakText = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    stopSpeaking();
    queueSpeech(trimmed);
  }, [queueSpeech, stopSpeaking]);

  const resetVoiceTranscript = useCallback(() => {
    clearDebounce();
    pendingTranscriptRef.current = '';
    flushedResultsLengthRef.current = lastResultsLengthRef.current;
    onTranscriptChange('');
  }, [clearDebounce, onTranscriptChange]);

  const pauseVoiceConversation = useCallback(() => {
    voicePausedRef.current = true;
    setVoicePaused(true);
    clearDebounce();
    pendingTranscriptRef.current = '';
    flushedResultsLengthRef.current = lastResultsLengthRef.current;
    onTranscriptChange('');
    stopSpeaking();
    stopRecognition();
    setPhase('off');
  }, [clearDebounce, onTranscriptChange, setPhase, stopRecognition, stopSpeaking]);

  const resumeVoiceConversation = useCallback(() => {
    voicePausedRef.current = false;
    setVoicePaused(false);
    setVoiceStatus(null);
    rapidRestartCountRef.current = 0;
    if (voiceModeRef.current) {
      updatePhaseFromActivity();
      ensureListening();
    }
  }, [ensureListening, updatePhaseFromActivity]);

  const toggleVoicePause = useCallback(() => {
    if (voicePausedRef.current) {
      resumeVoiceConversation();
    } else {
      pauseVoiceConversation();
    }
  }, [pauseVoiceConversation, resumeVoiceConversation]);

  const setAssistantMutedValue = useCallback((muted: boolean) => {
    assistantMutedRef.current = muted;
    setAssistantMuted(muted);
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : assistantVolumeRef.current;
    }
    try {
      globalThis.localStorage?.setItem(MUTE_STORAGE_KEY, muted ? 'true' : 'false');
    } catch {
      // ignore storage errors
    }
    if (muted) {
      speechQueueRef.current = [];
      stopSpeaking();
    }
  }, [stopSpeaking]);

  const toggleAssistantMuted = useCallback(() => {
    setAssistantMutedValue(!assistantMutedRef.current);
  }, [setAssistantMutedValue]);

  const setAssistantVolume = useCallback((volume: number) => {
    const nextVolume = Math.max(0, Math.min(1, volume));
    assistantVolumeRef.current = nextVolume;
    setAssistantVolumeState(nextVolume);
    if (audioRef.current && !assistantMutedRef.current) {
      audioRef.current.volume = nextVolume;
    }
    try {
      globalThis.localStorage?.setItem(VOLUME_STORAGE_KEY, String(nextVolume));
    } catch {
      // ignore storage errors
    }
  }, []);

  const enableVoiceMode = useCallback(async () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSttSupported(false);
      handleMicUnavailable('Voice input is not supported in this browser. Try Chrome or Edge on desktop.');
      return;
    }

    const micCheck = await checkMicrophoneAccess();
    if (!micCheck.ok) {
      handleMicUnavailable(micCheck.message);
      return;
    }

    micUnavailableRef.current = false;
    rapidRestartCountRef.current = 0;
    voiceModeRef.current = true;
    setVoiceMode(true);
    voicePausedRef.current = false;
    setVoicePaused(false);
    pendingTranscriptRef.current = '';
    flushedResultsLengthRef.current = 0;
    lastResultsLengthRef.current = 0;
    onTranscriptChange('');
    setVoiceStatus(null);
    startRecognitionRef.current();
  }, [handleMicUnavailable, onTranscriptChange]);

  const disableVoiceMode = useCallback(() => {
    voiceModeRef.current = false;
    voicePausedRef.current = false;
    setVoiceMode(false);
    setVoicePaused(false);
    rapidRestartCountRef.current = 0;
    clearDebounce();
    clearRestartTimer();
    stopSpeaking();
    stopRecognition();
    pendingTranscriptRef.current = '';
    flushedResultsLengthRef.current = 0;
    lastResultsLengthRef.current = 0;
    setPhase('off');
  }, [clearDebounce, clearRestartTimer, setPhase, stopRecognition, stopSpeaking]);

  const toggleVoiceMode = useCallback(() => {
    if (voiceModeRef.current) {
      disableVoiceMode();
    } else {
      void enableVoiceMode();
    }
  }, [disableVoiceMode, enableVoiceMode]);

  useEffect(() => {
    if (voiceMode && !prevVoiceModeRef.current) {
      lastSpokenRef.current = lastAssistantText ?? '';
    }
    prevVoiceModeRef.current = voiceMode;
  }, [voiceMode, lastAssistantText]);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
    if (!voiceModeRef.current) return;
    updatePhaseFromActivity();
    ensureListening();
  }, [isStreaming, updatePhaseFromActivity, ensureListening]);

  useEffect(() => {
    if (!voiceMode || !lastAssistantText?.trim()) return;

    if (voicePaused || assistantMuted) {
      lastSpokenRef.current = lastAssistantText;
      speechQueueRef.current = [];
      return;
    }

    if (!lastAssistantText.startsWith(lastSpokenRef.current)) {
      lastSpokenRef.current = '';
      speechQueueRef.current = [];
    }

    const unsaid = lastAssistantText.slice(lastSpokenRef.current.length);
    const speakable = extractSpeakablePrefix(unsaid, !isStreaming);
    if (!speakable.trim()) return;

    lastSpokenRef.current += speakable;
    queueSpeech(speakable);
  }, [voiceMode, voicePaused, assistantMuted, isStreaming, lastAssistantText, queueSpeech]);

  useEffect(() => {
    try {
      const storedVolume = globalThis.localStorage?.getItem(VOLUME_STORAGE_KEY);
      if (storedVolume !== null && storedVolume !== undefined) {
        const parsedVolume = Number(storedVolume);
        if (Number.isFinite(parsedVolume)) {
          const nextVolume = Math.max(0, Math.min(1, parsedVolume));
          assistantVolumeRef.current = nextVolume;
          setAssistantVolumeState(nextVolume);
        }
      }

      const storedMuted = globalThis.localStorage?.getItem(MUTE_STORAGE_KEY);
      if (storedMuted === 'true') {
        assistantMutedRef.current = true;
        setAssistantMuted(true);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    setSttSupported(getSpeechRecognitionCtor() !== null);
    return () => {
      voiceModeRef.current = false;
      clearDebounce();
      clearRestartTimer();
      stopSpeaking();
      stopRecognition();
    };
  }, [clearDebounce, clearRestartTimer, stopRecognition, stopSpeaking]);

  return {
    voiceMode,
    voicePhase,
    voicePaused,
    sttSupported,
    voiceStatus,
    isSpeaking,
    assistantMuted,
    assistantVolume,
    micUnavailableMessage,
    toggleVoiceMode,
    toggleVoicePause,
    toggleAssistantMuted,
    setAssistantVolume,
    dismissMicUnavailableDialog,
    stopSpeaking,
    speakText,
    resetVoiceTranscript,
    setVoiceStatus,
  };
}
