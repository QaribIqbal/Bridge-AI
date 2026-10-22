import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parseEnvFile } from '../src/shared/env-file';
import { extractGeminiText, redactSecrets } from '../src/main/gemini';
import { parseTranscriptionResponse } from '../src/shared/transcription';
import { windowPolicy } from '../src/shared/window-policy';
import { diarizationBanner, systemAudioMessage } from '../src/shared/status-copy';

describe('env file', () => {
  it('parses keys, quotes, and comments', () => {
    expect(
      parseEnvFile(`
# comment
GEMINI_API_KEY="abc"
BRIDGE_SUGGEST_SHORTCUT='Ctrl+Shift+Space'
EMPTY=
IGNORED
`),
    ).toEqual({
      GEMINI_API_KEY: 'abc',
      BRIDGE_SUGGEST_SHORTCUT: 'Ctrl+Shift+Space',
      EMPTY: '',
    });
  });
});

describe('Gemini response parsing', () => {
  it('joins text parts and redacts secrets from errors', () => {
    expect(
      extractGeminiText({
        candidates: [{ content: { parts: [{ text: 'Hello ' }, { text: 'there' }] } }],
      }),
    ).toBe('Hello there');

    expect(redactSecrets('bad key AIzaSyFakeKeyForRedactionOnly000000 in the message')).toBe(
      'bad key [redacted] in the message',
    );
  });

  it('reads a diarized transcription payload', () => {
    expect(
      parseTranscriptionResponse('{"diarized":true,"turns":[{"speaker":"A","text":"Hi"}]}'),
    ).toEqual({
      diarized: true,
      turns: [{ speaker: 'A', text: 'Hi' }],
    });
  });

  it('treats plain text as one unlabeled turn', () => {
    expect(parseTranscriptionResponse('just words')).toEqual({
      diarized: false,
      turns: [{ speaker: '', text: 'just words' }],
    });
  });
});

describe('honest status copy', () => {
  it('says transcription is unavailable without an STT engine', () => {
    expect(diarizationBanner('none')).toMatch(/not transcribing/i);
    expect(diarizationBanner('none')).toMatch(/OpenAI/i);
  });

  it('describes OpenAI live labels when STT is configured', () => {
    const banner = diarizationBanner('openai');
    expect(banner).toMatch(/Mixed/);
    expect(banner).toMatch(/You/);
    expect(banner).toMatch(/OpenAI/i);
  });

  it('warns that the Gemini audio path is slow', () => {
    expect(diarizationBanner('gemini')).toMatch(/slow/i);
    expect(diarizationBanner('gemini')).toMatch(/OPENAI_API_KEY/);
  });

  it('explains when system audio cannot be captured', () => {
    expect(systemAudioMessage('unavailable')).toMatch(/Microphone only/i);
    expect(systemAudioMessage('capturing')).toMatch(/meeting audio/i);
  });
});

describe('visible window policy', () => {
  it('is always on top, in the taskbar, and isolated from node', () => {
    expect(windowPolicy.alwaysOnTop).toBe(true);
    expect(windowPolicy.skipTaskbar).toBe(false);
    expect(windowPolicy.transparent).toBe(false);
    expect(windowPolicy.show).toBe(true);
    expect(windowPolicy.title).toBe('Bridge');
    expect(windowPolicy.webPreferences).toEqual({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    });
  });

  it('does not hide the window from capture anywhere in src', () => {
    const forbidden = [
      'setContentProtection',
      'WDA_EXCLUDEFROMCAPTURE',
      'SetWindowDisplayAffinity',
      'sharingType',
      'setIgnoreMouseEvents',
      'displayAffinity',
      'skipTaskbar: true',
      'setOpacity',
    ];
    const files = listFiles(path.join(process.cwd(), 'src'));
    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const token of forbidden) {
        if (source.includes(token))
          offenders.push(`${path.relative(process.cwd(), file)}: ${token}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

function listFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...listFiles(full));
    else files.push(full);
  }
  return files;
}
