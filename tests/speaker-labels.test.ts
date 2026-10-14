import { describe, expect, it } from 'vitest';
import { labelSpeakerTurns } from '../src/shared/speaker-labels';

describe('speaker labels', () => {
  it('labels a single microphone voice as You without claiming diarization', () => {
    const result = labelSpeakerTurns('microphone', {
      diarized: false,
      turns: [{ speaker: 'A', text: 'Sounds good to me' }],
    });

    expect(result.diarized).toBe(false);
    expect(result.turns).toEqual([{ speaker: 'You', text: 'Sounds good to me', diarized: false }]);
  });

  it('keeps distinct microphone voices when Gemini reports more than one', () => {
    const result = labelSpeakerTurns('microphone', {
      diarized: true,
      turns: [
        { speaker: 'A', text: 'I will share my screen' },
        { speaker: 'B', text: 'Wait, one second' },
      ],
    });

    expect(result.diarized).toBe(true);
    expect(result.turns.map((turn) => turn.speaker)).toEqual(['Mic · A', 'Mic · B']);
  });

  it('labels an undifferentiated system stream as Mixed', () => {
    const result = labelSpeakerTurns('system', {
      diarized: false,
      turns: [
        { speaker: 'Speaker A', text: 'Can you hear me' },
        { speaker: 'Speaker A', text: 'the slide is up' },
      ],
    });

    expect(result.diarized).toBe(false);
    expect(result.turns).toEqual([
      { speaker: 'Mixed', text: 'Can you hear me the slide is up', diarized: false },
    ]);
    expect(result.note).toMatch(/not separate speakers/i);
  });

  it('does not invent speakers when Gemini marks a system chunk diarized but names one voice', () => {
    const result = labelSpeakerTurns('system', {
      diarized: true,
      turns: [{ speaker: 'A', text: 'Just one voice in the room' }],
    });

    expect(result.diarized).toBe(false);
    expect(result.turns[0]?.speaker).toBe('Mixed');
  });

  it('keeps Gemini speaker names when a system chunk actually has more than one', () => {
    const result = labelSpeakerTurns('system', {
      diarized: true,
      turns: [
        { speaker: 'A', text: 'Let us start' },
        { speaker: 'B', text: 'I have a question' },
      ],
    });

    expect(result.diarized).toBe(true);
    expect(result.turns.map((turn) => turn.speaker)).toEqual(['Speaker A', 'Speaker B']);
    expect(result.note).toMatch(/this chunk only/i);
  });

  it('drops empty turns', () => {
    const result = labelSpeakerTurns('system', {
      diarized: true,
      turns: [
        { speaker: 'A', text: '   ' },
        { speaker: 'B', text: 'Hello' },
        { speaker: 'C', text: 'There' },
      ],
    });

    expect(result.turns.map((turn) => turn.text)).toEqual(['Hello', 'There']);
  });
});
