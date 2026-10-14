export class GeminiError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
  }
}

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

export function extractGeminiText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return '';
  const first = candidates[0] as { content?: { parts?: Array<{ text?: unknown }> } } | undefined;
  const parts = first?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('');
}

export function redactSecrets(text: string): string {
  return text.replace(/AIza[0-9A-Za-z_-]{10,}/g, '[redacted]');
}

export function formatGeminiError(status: number, payload: unknown): string {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error?: { message?: unknown } }).error;
    if (typeof error?.message === 'string' && error.message.trim()) return error.message;
  }
  return `Gemini request failed (${status})`;
}

export async function geminiGenerate(options: {
  apiKey: string;
  model: string;
  parts: GeminiPart[];
  system?: string;
  json?: boolean;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<string> {
  if (!options.apiKey.trim()) {
    throw new GeminiError('Add GEMINI_API_KEY to the gitignored .env file.');
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.model)}:generateContent`;
  const body: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts: options.parts.map((part) =>
          'text' in part
            ? { text: part.text }
            : {
                inline_data: {
                  mime_type: part.inlineData.mimeType,
                  data: part.inlineData.data,
                },
              },
        ),
      },
    ],
    generationConfig: options.json
      ? { responseMimeType: 'application/json', temperature: 0.2 }
      : { temperature: 0.7 },
  };
  if (options.system) body.systemInstruction = { parts: [{ text: options.system }] };

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': options.apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options.timeoutMs ?? 45_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gemini request failed.';
    if (/aborted|timeout/i.test(message)) throw new GeminiError('Gemini took too long. Try again.');
    throw new GeminiError(redactSecrets(message));
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new GeminiError(`Gemini returned an unreadable response (${response.status}).`);
  }
  if (!response.ok) {
    throw new GeminiError(
      redactSecrets(formatGeminiError(response.status, payload)),
      response.status,
    );
  }
  const text = extractGeminiText(payload).trim();
  if (!text) throw new GeminiError('Gemini returned no text.');
  return text;
}
