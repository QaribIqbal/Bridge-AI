import type { SystemAudioStatus } from './types';

export function diarizationBanner(hasKey: boolean): string {
  if (!hasKey) {
    return 'No Gemini API key. Bridge is not transcribing. Add GEMINI_API_KEY to the gitignored .env file. Speaker labels are unavailable until audio can be sent to Gemini.';
  }
  return 'Speaker labels are only as good as Gemini audio understanding. Your microphone is labeled You because it is a separate recording. Other people on system audio are labeled per chunk only when Gemini can hear more than one voice; otherwise that audio stays Mixed. This is not a dedicated diarization model, and labels can change between chunks.';
}

export function systemAudioMessage(status: SystemAudioStatus): string {
  if (status === 'capturing') return 'Microphone and system audio are both on.';
  if (status === 'unavailable') {
    return 'System audio is not available. Bridge is using the microphone only. Loopback needs an OS path that does not use a custom kernel driver (Windows WASAPI, or macOS 13 and later with screen recording permission). Linux may expose a PipeWire or PulseAudio monitor; if it does not, only the microphone is used.';
  }
  return 'Microphone is off.';
}
