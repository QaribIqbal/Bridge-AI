import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { openaiTranscribe } = require('../dist/openai-stt.js');

function readEnv(file) {
  const result = {};
  for (const line of readFileSync(file, 'utf8').split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    result[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^["']|["']$/g, '');
  }
  return result;
}

function redact(value) {
  return String(value)
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, '[redacted]')
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, '[redacted]');
}

// Minimal valid-ish WebM/Opus isn't trivial to synthesize. Use a tiny WAV
// (silence) that whisper-compatible endpoints accept.
function silentWav(durationMs = 800, sampleRate = 16_000) {
  const samples = Math.floor((sampleRate * durationMs) / 1000);
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

async function main() {
  const envPath = path.join(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    console.log(JSON.stringify({ ok: false, reason: 'no .env', skipped: true }));
    process.exit(0);
  }
  const env = readEnv(envPath);
  const apiKey = (env.OPENAI_API_KEY || '').trim();
  if (!apiKey || apiKey.includes('your-openai')) {
    console.log(JSON.stringify({ ok: false, reason: 'OPENAI_API_KEY missing', skipped: true }));
    process.exit(0);
  }

  const model = (env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe').trim();
  const started = Date.now();
  try {
    const text = await openaiTranscribe({
      apiKey,
      model,
      mimeType: 'audio/wav',
      data: silentWav(),
      timeoutMs: 20_000,
    });
    const ms = Date.now() - started;
    console.log(
      JSON.stringify({
        ok: true,
        model,
        latencyMs: ms,
        textLength: text.length,
      }),
    );
  } catch (error) {
    console.error(redact(error instanceof Error ? error.message : error));
    process.exit(1);
  }
}

void main();
