import { describe, expect, it } from 'vitest';
import {
  audioExtensionForMime,
  extractTranscriptionText,
  openaiTranscribe,
  redactOpenAiSecrets,
} from '../src/main/openai-stt';
import { AUDIO_CHUNK_MS } from '../src/shared/chunking';

describe('openai stt helpers', () => {
  it('maps mime types to file extensions', () => {
    expect(audioExtensionForMime('audio/webm;codecs=opus')).toBe('webm');
    expect(audioExtensionForMime('audio/ogg')).toBe('ogg');
    expect(audioExtensionForMime('audio/wav')).toBe('wav');
  });

  it('extracts transcript text and redacts secrets', () => {
    expect(extractTranscriptionText({ text: ' hello ' })).toBe('hello');
    expect(redactOpenAiSecrets('bad sk-abcdefghijklmnopqrstuvwxyz0123456789')).toMatch(
      /\[redacted\]/,
    );
  });

  it('keeps chunk duration in the 2–3s live window', () => {
    expect(AUDIO_CHUNK_MS).toBeGreaterThanOrEqual(2_000);
    expect(AUDIO_CHUNK_MS).toBeLessThanOrEqual(3_000);
  });

  it('posts multipart audio to the transcriptions endpoint', async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ text: 'hello there' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    const text = await openaiTranscribe({
      apiKey: 'sk-test',
      mimeType: 'audio/webm',
      data: new Uint8Array(1200).fill(1),
      fetchImpl,
    });

    expect(text).toBe('hello there');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect(calls[0]?.init?.method).toBe('POST');
    expect(calls[0]?.init?.headers).toMatchObject({ authorization: 'Bearer sk-test' });
    expect(calls[0]?.init?.body).toBeInstanceOf(FormData);
  });
});
