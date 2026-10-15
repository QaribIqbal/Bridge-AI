import type { SystemAudioStatus } from './types';

export function diarizationBanner(hasKey: boolean): string {
  if (!hasKey) return 'Add a Gemini API key in Settings. Bridge is not transcribing yet.';
  return 'Your mic is labeled You. Other people stay Mixed unless more than one voice is clear.';
}

export function systemAudioMessage(status: SystemAudioStatus): string {
  if (status === 'capturing') return 'Mic and meeting audio are on.';
  if (status === 'unavailable')
    return 'Microphone only. Allow Screen Recording to include other people.';
  return '';
}
