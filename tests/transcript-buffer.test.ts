import { describe, expect, it } from 'vitest';
import { createTranscriptBuffer } from '../src/shared/transcript-buffer';

describe('transcript buffer', () => {
  it('appends a speaker turn', () => {
    const buffer = createTranscriptBuffer();
    buffer.append({
      speaker: 'You',
      channel: 'microphone',
      text: 'Hello there',
      atMs: 1_000,
      diarized: false,
    });

    expect(buffer.all()).toEqual([
      {
        id: 't1',
        speaker: 'You',
        channel: 'microphone',
        text: 'Hello there',
        atMs: 1_000,
        diarized: false,
      },
    ]);
  });

  it('merges adjacent turns from the same speaker on the same channel', () => {
    const buffer = createTranscriptBuffer({ mergeGapMs: 10_000 });
    buffer.append({
      speaker: 'You',
      channel: 'microphone',
      text: 'Hello',
      atMs: 1_000,
      diarized: false,
    });
    buffer.append({
      speaker: 'You',
      channel: 'microphone',
      text: '  everyone  ',
      atMs: 9_000,
      diarized: false,
    });

    expect(buffer.all()).toHaveLength(1);
    expect(buffer.all()[0]).toMatchObject({
      id: 't1',
      text: 'Hello everyone',
      atMs: 9_000,
    });
  });

  it('does not merge different speakers or different channels', () => {
    const buffer = createTranscriptBuffer({ mergeGapMs: 10_000 });
    buffer.append({
      speaker: 'Speaker A',
      channel: 'system',
      text: 'The bug is in the parser',
      atMs: 1_000,
      diarized: true,
    });
    buffer.append({
      speaker: 'Speaker B',
      channel: 'system',
      text: 'I can take that',
      atMs: 2_000,
      diarized: true,
    });
    buffer.append({
      speaker: 'Speaker A',
      channel: 'microphone',
      text: 'Different recording',
      atMs: 3_000,
      diarized: true,
    });

    expect(buffer.all().map((turn) => turn.text)).toEqual([
      'The bug is in the parser',
      'I can take that',
      'Different recording',
    ]);
  });

  it('starts a new turn when the gap is too large', () => {
    const buffer = createTranscriptBuffer({ mergeGapMs: 1_000 });
    buffer.append({
      speaker: 'You',
      channel: 'microphone',
      text: 'First',
      atMs: 0,
      diarized: false,
    });
    buffer.append({
      speaker: 'You',
      channel: 'microphone',
      text: 'Later',
      atMs: 5_000,
      diarized: false,
    });

    expect(buffer.all()).toHaveLength(2);
  });

  it('drops blank text', () => {
    const buffer = createTranscriptBuffer();
    buffer.append({
      speaker: 'You',
      channel: 'microphone',
      text: '   ',
      atMs: 1_000,
      diarized: false,
    });

    expect(buffer.all()).toEqual([]);
  });

  it('drops the oldest turn after the cap', () => {
    const buffer = createTranscriptBuffer({ maxTurns: 2, mergeGapMs: 0 });
    for (const [index, text] of ['one', 'two', 'three'].entries()) {
      buffer.append({
        speaker: 'You',
        channel: 'microphone',
        text,
        atMs: index * 100,
        diarized: false,
      });
    }

    expect(buffer.all().map((turn) => turn.text)).toEqual(['two', 'three']);
  });

  it('returns the newest turns that fit the recent character budget, in order', () => {
    const buffer = createTranscriptBuffer({ recentCharBudget: 20, mergeGapMs: 0 });
    buffer.append({
      speaker: 'You',
      channel: 'microphone',
      text: 'older words here',
      atMs: 1,
      diarized: false,
    });
    buffer.append({
      speaker: 'Mixed',
      channel: 'system',
      text: 'middle',
      atMs: 2,
      diarized: false,
    });
    buffer.append({
      speaker: 'You',
      channel: 'microphone',
      text: 'newest',
      atMs: 3,
      diarized: false,
    });

    const recent = buffer.recent();
    expect(recent.map((turn) => turn.text)).toEqual(['middle', 'newest']);
    expect(buffer.format(recent)).toBe('Mixed: middle\nYou: newest');
  });

  it('keeps a single turn even when it is larger than the budget', () => {
    const buffer = createTranscriptBuffer({ recentCharBudget: 5 });
    buffer.append({
      speaker: 'You',
      channel: 'microphone',
      text: 'this turn is long',
      atMs: 1,
      diarized: false,
    });

    expect(buffer.recent().map((turn) => turn.text)).toEqual(['this turn is long']);
  });

  it('clears the transcript', () => {
    const buffer = createTranscriptBuffer();
    buffer.append({
      speaker: 'You',
      channel: 'microphone',
      text: 'Hello',
      atMs: 1,
      diarized: false,
    });
    buffer.clear();
    expect(buffer.all()).toEqual([]);
  });
});
