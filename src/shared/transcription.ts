import type { Channel } from './types';
import { extractJson } from './json';

export type TranscriptionParse = {
  diarized: boolean;
  turns: Array<{ speaker: string; text: string }>;
};

export function buildTranscriptionPrompt(channel: Channel): { system: string; user: string } {
  return {
    system: [
      'You transcribe a short meeting audio chunk.',
      'Return JSON only: {"diarized": boolean, "turns": [{"speaker": string, "text": string}]}.',
      `The recording channel is "${channel}".`,
      "microphone means the local user's own microphone.",
      'system means mixed audio from the computer, usually other people in the meeting.',
      'Set diarized to true only when you can hear more than one distinct person in this chunk.',
      'When you can, name those people A, B, and C in the order they start speaking.',
      'When you cannot tell people apart, set diarized to false and return a single turn.',
      'Do not invent speakers for a single mixed stream.',
    ].join(' '),
    user: 'Transcribe the attached audio.',
  };
}

export function parseTranscriptionResponse(raw: string): TranscriptionParse {
  const parsed = extractJson(raw);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const record = parsed as Record<string, unknown>;
    if (Array.isArray(record.turns)) {
      const turns = record.turns
        .map((turn) => {
          if (!turn || typeof turn !== 'object') return null;
          const item = turn as Record<string, unknown>;
          const text = typeof item.text === 'string' ? item.text.trim() : '';
          if (!text) return null;
          const speaker = typeof item.speaker === 'string' ? item.speaker.trim() : '';
          return { speaker, text };
        })
        .filter((turn): turn is { speaker: string; text: string } => turn !== null);
      return { diarized: record.diarized === true, turns };
    }
  }
  const text = raw.trim();
  if (!text) return { diarized: false, turns: [] };
  return { diarized: false, turns: [{ speaker: '', text }] };
}
