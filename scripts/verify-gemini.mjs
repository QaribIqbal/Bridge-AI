import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { geminiGenerate } = require('../dist/gemini.js');

const redact = (value) => String(value).replace(/AIza[0-9A-Za-z_-]{10,}/g, '[redacted]');

function readEnv(file) {
  const result = {};
  for (const line of readFileSync(file, 'utf8').split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    result[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return result;
}

function crc32(buf) {
  let crc = ~0;
  for (const byte of buf) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}

function png() {
  const width = 48;
  const height = 48;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const i = row + 1 + x * 4;
      const left = x < 24;
      raw[i] = left ? 220 : 30;
      raw[i + 1] = left ? 30 : 60;
      raw[i + 2] = left ? 30 : 220;
      raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function wav() {
  const sampleRate = 16000;
  const samples = sampleRate / 2;
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i += 1) {
    const sample = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.4;
    data.writeInt16LE(Math.round(sample * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const env = readEnv(new URL('../.env', import.meta.url));
const modelSource = readFileSync(new URL('../src/shared/models.ts', import.meta.url), 'utf8');
const model = modelSource.match(/DEFAULT_MODEL = '([^']+)'/)?.[1];
if (!model) {
  console.error('Could not read DEFAULT_MODEL');
  process.exit(1);
}
const apiKey = env.GEMINI_API_KEY ?? '';
if (!apiKey) {
  console.error('GEMINI_API_KEY is missing from .env');
  process.exit(1);
}

const checks = [];

async function check(name, parts, json = false) {
  try {
    const text = await geminiGenerate({ apiKey, model, parts, json, timeoutMs: 45_000 });
    checks.push({ name, ok: true, text: redact(text).slice(0, 180) });
    console.log(name, 'ok', redact(text).slice(0, 180));
  } catch (error) {
    const message = redact(error instanceof Error ? error.message : String(error));
    checks.push({ name, ok: false, text: message });
    console.error(name, 'failed', message);
  }
}

await check('text', [{ text: 'Reply with the single word pong.' }]);
await check('vision', [
  { text: 'Name the left color and the right color. Be brief.' },
  { inlineData: { mimeType: 'image/png', data: png().toString('base64') } },
]);
await check('audio', [
  { text: 'What do you hear? Reply in eight words or fewer.' },
  { inlineData: { mimeType: 'audio/wav', data: wav().toString('base64') } },
]);
await check('json', [{ text: 'Return JSON {"ok":true} and nothing else.' }], true);

const outDir = '/opt/cursor/artifacts';
mkdirSync(outDir, { recursive: true });
const report = { model, checks };
writeFileSync(path.join(outDir, 'gemini-verify.json'), JSON.stringify(report, null, 2));
if (checks.some((item) => !item.ok)) process.exit(1);
console.log('verified', model);
