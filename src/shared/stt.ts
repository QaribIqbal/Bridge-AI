/** Fast speech-to-text model for short complete audio files. */
export const DEFAULT_OPENAI_TRANSCRIBE_MODEL = 'gpt-4o-mini-transcribe';

export function normalizeOpenAiTranscribeModel(raw: string | undefined): string {
  const name = raw?.trim() ?? '';
  if (!/^[a-z0-9][a-z0-9._-]{0,80}$/i.test(name)) return DEFAULT_OPENAI_TRANSCRIBE_MODEL;
  return name;
}
