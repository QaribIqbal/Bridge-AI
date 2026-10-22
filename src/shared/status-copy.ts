import type { KeySource, SttEngine, SystemAudioStatus } from './types';

export function diarizationBanner(engine: SttEngine): string {
  if (engine === 'none') {
    return 'Add an OpenAI API key in Settings for fast live transcription. Bridge is not transcribing yet.';
  }
  if (engine === 'gemini') {
    return 'Slow path: Gemini is transcribing audio. Add OPENAI_API_KEY for near-real-time speech. Mic stays You; system stays Mixed unless voices are clearly separated.';
  }
  return 'Live STT (OpenAI). Your mic is labeled You. Meeting audio stays Mixed — this STT path does not separate speakers.';
}

export function engineStatusLine(options: {
  sttEngine: SttEngine;
  openaiKeySource: KeySource;
  geminiKeySource: KeySource;
  model: string;
  openaiTranscribeModel: string;
}): string {
  const openai = keyPhrase(options.openaiKeySource, 'OpenAI');
  const gemini = keyPhrase(options.geminiKeySource, 'Gemini');
  if (options.sttEngine === 'openai') {
    return `Engine: OpenAI ${options.openaiTranscribeModel} for transcript · Gemini ${options.model} for Suggest / Read screen. ${openai} ${gemini}`;
  }
  if (options.sttEngine === 'gemini') {
    return `Engine: Gemini ${options.model} for transcript (slow), Suggest, and Read screen. ${openai} ${gemini}`;
  }
  return `Engine: none. ${openai} ${gemini}`;
}

export function systemAudioMessage(status: SystemAudioStatus): string {
  if (status === 'capturing') return 'Mic and meeting audio are on.';
  if (status === 'unavailable')
    return 'Microphone only. Allow Screen Recording to include other people.';
  return '';
}

function keyPhrase(source: KeySource, label: string): string {
  if (source === 'env') return `${label} key from .env.`;
  if (source === 'saved') return `${label} key saved in app data.`;
  return `${label} key missing.`;
}
