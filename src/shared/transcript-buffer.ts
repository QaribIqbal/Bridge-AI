import type { Channel, TranscriptTurn } from './types';

export type TranscriptDraft = {
  speaker: string;
  channel: Channel;
  text: string;
  atMs: number;
  diarized: boolean;
};

export type TranscriptBufferOptions = {
  maxTurns?: number;
  mergeGapMs?: number;
  recentCharBudget?: number;
  maxMergedChars?: number;
};

export type TranscriptBuffer = {
  append(draft: TranscriptDraft): readonly TranscriptTurn[];
  recent(): TranscriptTurn[];
  all(): readonly TranscriptTurn[];
  format(turns?: readonly TranscriptTurn[]): string;
  clear(): void;
};

export function createTranscriptBuffer(options: TranscriptBufferOptions = {}): TranscriptBuffer {
  const maxTurns = options.maxTurns ?? 200;
  const mergeGapMs = options.mergeGapMs ?? 12_000;
  const recentCharBudget = options.recentCharBudget ?? 4_000;
  const maxMergedChars = options.maxMergedChars ?? 1_500;
  const turns: TranscriptTurn[] = [];
  let nextId = 1;

  return {
    append(draft) {
      const text = draft.text.trim().replace(/\s+/g, ' ');
      if (!text) return turns;
      const last = turns[turns.length - 1];
      const canMerge =
        last !== undefined &&
        last.speaker === draft.speaker &&
        last.channel === draft.channel &&
        last.diarized === draft.diarized &&
        last.text.length < maxMergedChars &&
        draft.atMs >= last.atMs &&
        draft.atMs - last.atMs <= mergeGapMs;
      if (canMerge && last) {
        last.text = `${last.text} ${text}`;
        last.atMs = draft.atMs;
      } else {
        turns.push({
          id: `t${nextId}`,
          speaker: draft.speaker,
          channel: draft.channel,
          text,
          atMs: draft.atMs,
          diarized: draft.diarized,
        });
        nextId += 1;
      }
      while (turns.length > maxTurns) turns.shift();
      return turns;
    },
    recent() {
      const selected: TranscriptTurn[] = [];
      let used = 0;
      for (let index = turns.length - 1; index >= 0; index -= 1) {
        const turn = turns[index];
        if (!turn) break;
        if (selected.length > 0 && used + turn.text.length > recentCharBudget) break;
        selected.push(turn);
        used += turn.text.length;
      }
      return selected.reverse();
    },
    all() {
      return turns;
    },
    format(list = turns) {
      return list.map((turn) => `${turn.speaker}: ${turn.text}`).join('\n');
    },
    clear() {
      turns.length = 0;
    },
  };
}
