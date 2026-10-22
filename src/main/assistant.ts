import { createTranscriptBuffer, type TranscriptBuffer } from '../shared/transcript-buffer';
import { buildCodingPrompt, buildSuggestReplyPrompt, parseCodingResponse } from '../shared/prompts';
import { labelSpeakerTurns } from '../shared/speaker-labels';
import { diarizationBanner, engineStatusLine, systemAudioMessage } from '../shared/status-copy';
import { buildTranscriptionPrompt, parseTranscriptionResponse } from '../shared/transcription';
import type {
  AudioChunk,
  Channel,
  CodingSolution,
  PublicState,
  SystemAudioStatus,
} from '../shared/types';
import type { ResolvedSettings } from '../shared/settings';
import { LatestJobQueue } from './audio-queue';
import { geminiGenerate, redactSecrets } from './gemini';
import { openaiTranscribe, redactOpenAiSecrets } from './openai-stt';

const MIN_CHUNK_BYTES = 800;
const MAX_CHUNK_BYTES = 8_000_000;

export function parseAudioChunk(input: unknown): AudioChunk | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  if (value.channel !== 'microphone' && value.channel !== 'system') return null;
  if (
    typeof value.mimeType !== 'string' ||
    !/^audio\/[a-zA-Z0-9.+-]+(?:;codecs=[a-zA-Z0-9.,]+)?$/.test(value.mimeType)
  ) {
    return null;
  }
  if (typeof value.atMs !== 'number' || !Number.isFinite(value.atMs)) return null;
  const data = asBytes(value.bytes);
  if (!data || data.byteLength < MIN_CHUNK_BYTES || data.byteLength > MAX_CHUNK_BYTES) return null;
  const mimeType = value.mimeType.split(';')[0]?.trim() || value.mimeType;
  return { channel: value.channel, mimeType, data, atMs: value.atMs };
}

export class Assistant {
  private readonly buffer: TranscriptBuffer = createTranscriptBuffer();
  private readonly tails: Record<Channel, LatestJobQueue<AudioChunk>> = {
    microphone: new LatestJobQueue((chunk) => this.transcribe(chunk)),
    system: new LatestJobQueue((chunk) => this.transcribe(chunk)),
  };
  private listening = false;
  private systemAudio: SystemAudioStatus = 'idle';
  private suggestion = '';
  private solution: CodingSolution | null = null;
  private status = '';
  private shortcutWarning = '';
  private assistBusy = false;

  constructor(
    private settings: ResolvedSettings,
    private readonly publish: (state: PublicState) => void,
    private readonly captureScreen: () => Promise<Buffer> = async () => {
      throw new Error('Screen capture is not available.');
    },
  ) {}

  snapshot(): PublicState {
    return {
      listening: this.listening,
      micActive: this.listening,
      systemAudio: this.systemAudio,
      keySource: this.settings.geminiKeySource,
      geminiKeySource: this.settings.geminiKeySource,
      openaiKeySource: this.settings.openaiKeySource,
      sttEngine: this.settings.sttEngine,
      model: this.settings.model,
      openaiTranscribeModel: this.settings.openaiTranscribeModel,
      suggestShortcut: this.settings.suggestShortcut,
      captureShortcut: this.settings.captureShortcut,
      turns: [...this.buffer.all()],
      suggestion: this.suggestion,
      solution: this.solution,
      status: [this.shortcutWarning, this.status].filter(Boolean).join(' '),
      banner: diarizationBanner(this.settings.sttEngine),
      engineStatus: engineStatusLine({
        sttEngine: this.settings.sttEngine,
        openaiKeySource: this.settings.openaiKeySource,
        geminiKeySource: this.settings.geminiKeySource,
        model: this.settings.model,
        openaiTranscribeModel: this.settings.openaiTranscribeModel,
      }),
      systemAudioDetail: systemAudioMessage(this.listening ? this.systemAudio : 'idle'),
    };
  }

  setSettings(settings: ResolvedSettings): void {
    this.settings = settings;
    this.emit();
  }

  setShortcutWarning(warning: string): void {
    this.shortcutWarning = warning;
    this.emit();
  }

  setListening(listening: boolean): void {
    this.listening = listening;
    if (!listening) this.systemAudio = 'idle';
    this.emit();
  }

  setSystemAudio(status: SystemAudioStatus): void {
    this.systemAudio = status;
    this.emit();
  }

  enqueueAudio(chunk: AudioChunk): void {
    this.tails[chunk.channel].push(chunk);
  }

  async suggestReply(): Promise<void> {
    if (this.assistBusy) {
      this.status = 'Still thinking…';
      this.emit();
      return;
    }
    if (!this.settings.geminiApiKey) {
      this.suggestion = '';
      this.status = 'Add GEMINI_API_KEY to .env before asking for a reply.';
      this.emit();
      return;
    }
    this.assistBusy = true;
    this.status = 'Writing a reply…';
    this.emit();
    try {
      const prompt = buildSuggestReplyPrompt(this.buffer.recent());
      this.suggestion = await geminiGenerate({
        apiKey: this.settings.geminiApiKey,
        model: this.settings.model,
        system: prompt.system,
        timeoutMs: 12_000,
        parts: [{ text: prompt.user }],
      });
      this.status = '';
    } catch (error) {
      this.status = messageFrom(error, 'Could not write a reply.');
    } finally {
      this.assistBusy = false;
      this.emit();
    }
  }

  async solveFromScreen(): Promise<void> {
    if (this.assistBusy) {
      this.status = 'Still thinking…';
      this.emit();
      return;
    }
    if (!this.settings.geminiApiKey) {
      this.status = 'Add GEMINI_API_KEY to .env before capturing the screen.';
      this.emit();
      return;
    }
    this.assistBusy = true;
    this.status = 'Reading the screen…';
    this.emit();
    try {
      const png = await this.captureScreen();
      const prompt = buildCodingPrompt(this.buffer.recent());
      const raw = await geminiGenerate({
        apiKey: this.settings.geminiApiKey,
        model: this.settings.model,
        system: prompt.system,
        json: true,
        timeoutMs: 20_000,
        parts: [
          { text: prompt.user },
          { inlineData: { mimeType: 'image/png', data: png.toString('base64') } },
        ],
      });
      this.solution = parseCodingResponse(raw);
      this.status = this.solution.isCodingProblem ? '' : this.solution.explanation;
    } catch (error) {
      this.status = messageFrom(error, 'Could not read the screen.');
    } finally {
      this.assistBusy = false;
      this.emit();
    }
  }

  private async transcribe(chunk: AudioChunk): Promise<void> {
    if (this.settings.sttEngine === 'none') {
      this.status =
        'Add OPENAI_API_KEY for fast transcription, or GEMINI_API_KEY as a slow fallback.';
      this.emit();
      return;
    }
    this.setBackgroundStatus(
      this.settings.sttEngine === 'openai' ? 'Transcribing…' : 'Transcribing (slow Gemini path)…',
    );
    try {
      if (this.settings.sttEngine === 'openai') {
        await this.transcribeWithOpenAi(chunk);
      } else {
        await this.transcribeWithGemini(chunk);
      }
      this.setBackgroundStatus('');
    } catch (error) {
      const message = messageFrom(error, 'Transcription failed.');
      // A headerless audio fragment is rejected as an invalid argument. Skip it.
      this.setBackgroundStatus(/invalid argument/i.test(message) ? '' : message);
    }
    this.emit();
  }

  private async transcribeWithOpenAi(chunk: AudioChunk): Promise<void> {
    const text = await openaiTranscribe({
      apiKey: this.settings.openaiApiKey,
      model: this.settings.openaiTranscribeModel,
      mimeType: chunk.mimeType,
      data: chunk.data,
      timeoutMs: 10_000,
    });
    // Honest labels only: dedicated STT does not return speaker IDs here.
    const labeled = labelSpeakerTurns(chunk.channel, {
      diarized: false,
      turns: [{ speaker: '', text }],
    });
    for (const turn of labeled.turns) {
      this.buffer.append({
        speaker: turn.speaker,
        channel: chunk.channel,
        text: turn.text,
        atMs: chunk.atMs,
        diarized: turn.diarized,
      });
    }
  }

  private async transcribeWithGemini(chunk: AudioChunk): Promise<void> {
    const prompt = buildTranscriptionPrompt(chunk.channel);
    const raw = await geminiGenerate({
      apiKey: this.settings.geminiApiKey,
      model: this.settings.model,
      system: prompt.system,
      json: true,
      timeoutMs: 12_000,
      parts: [
        { text: prompt.user },
        {
          inlineData: {
            mimeType: chunk.mimeType,
            data: Buffer.from(chunk.data).toString('base64'),
          },
        },
      ],
    });
    const parsed = parseTranscriptionResponse(raw);
    const labeled = labelSpeakerTurns(chunk.channel, parsed);
    for (const turn of labeled.turns) {
      this.buffer.append({
        speaker: turn.speaker,
        channel: chunk.channel,
        text: turn.text,
        atMs: chunk.atMs,
        diarized: turn.diarized,
      });
    }
    if (labeled.note) this.setBackgroundStatus(labeled.note);
  }

  private setBackgroundStatus(next: string): void {
    if (this.assistBusy) return;
    this.status = next;
    this.emit();
  }

  private emit(): void {
    this.publish(this.snapshot());
  }
}

function asBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return null;
}

function messageFrom(error: unknown, fallback: string): string {
  const message = error instanceof Error && error.message ? error.message : fallback;
  return redactOpenAiSecrets(redactSecrets(message));
}
