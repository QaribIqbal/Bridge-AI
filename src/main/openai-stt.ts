import { DEFAULT_OPENAI_TRANSCRIBE_MODEL } from '../shared/stt';

export { DEFAULT_OPENAI_TRANSCRIBE_MODEL };

export class OpenAiSttError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'OpenAiSttError';
    this.status = status;
  }
}

export function redactOpenAiSecrets(text: string): string {
  return text
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, '[redacted]')
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, '[redacted]');
}

export function audioExtensionForMime(mimeType: string): string {
  const base = mimeType.split(';')[0]?.trim().toLowerCase() || 'audio/webm';
  if (base === 'audio/ogg' || base === 'audio/opus') return 'ogg';
  if (base === 'audio/mp4' || base === 'audio/m4a') return 'm4a';
  if (base === 'audio/mpeg' || base === 'audio/mp3') return 'mp3';
  if (base === 'audio/wav' || base === 'audio/wave') return 'wav';
  return 'webm';
}

export function extractTranscriptionText(payload: unknown): string {
  if (typeof payload === 'string') return payload.trim();
  if (!payload || typeof payload !== 'object') return '';
  const text = (payload as { text?: unknown }).text;
  return typeof text === 'string' ? text.trim() : '';
}

export function formatOpenAiError(status: number, payload: unknown): string {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error?: { message?: unknown } }).error;
    if (typeof error?.message === 'string' && error.message.trim()) return error.message;
  }
  return `OpenAI transcription failed (${status})`;
}

export async function openaiTranscribe(options: {
  apiKey: string;
  data: Uint8Array;
  mimeType: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<string> {
  if (!options.apiKey.trim()) {
    throw new OpenAiSttError('Add OPENAI_API_KEY to the gitignored .env file.');
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const model = options.model?.trim() || DEFAULT_OPENAI_TRANSCRIBE_MODEL;
  const extension = audioExtensionForMime(options.mimeType);
  const mimeType = options.mimeType.split(';')[0]?.trim() || 'audio/webm';
  const file = new File([Buffer.from(options.data)], `chunk.${extension}`, { type: mimeType });
  const body = new FormData();
  body.append('file', file);
  body.append('model', model);
  // Prefer plain text when the model allows it; fall back parsing JSON below.
  body.append('response_format', 'json');

  let response: Response;
  try {
    response = await fetchImpl('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${options.apiKey}`,
      },
      body,
      signal: AbortSignal.timeout(options.timeoutMs ?? 12_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OpenAI transcription failed.';
    if (/aborted|timeout/i.test(message)) {
      throw new OpenAiSttError('Transcription took too long. Try again.');
    }
    throw new OpenAiSttError(redactOpenAiSecrets(message));
  }

  const contentType = response.headers.get('content-type') ?? '';
  let payload: unknown;
  try {
    if (contentType.includes('application/json')) {
      payload = await response.json();
    } else {
      payload = await response.text();
    }
  } catch {
    throw new OpenAiSttError(`OpenAI returned an unreadable response (${response.status}).`);
  }

  if (!response.ok) {
    throw new OpenAiSttError(
      redactOpenAiSecrets(formatOpenAiError(response.status, payload)),
      response.status,
    );
  }

  const text = extractTranscriptionText(payload);
  if (!text) throw new OpenAiSttError('OpenAI returned no transcript text.');
  return text;
}
