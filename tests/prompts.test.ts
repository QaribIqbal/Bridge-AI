import { describe, expect, it } from 'vitest';
import {
  buildCodingPrompt,
  buildSuggestReplyPrompt,
  parseCodingResponse,
} from '../src/shared/prompts';
import type { TranscriptTurn } from '../src/shared/types';

const turns: TranscriptTurn[] = [
  {
    id: 't1',
    speaker: 'You',
    channel: 'microphone',
    text: 'I can walk through the parser.',
    atMs: 1,
    diarized: false,
  },
  {
    id: 't2',
    speaker: 'Speaker A',
    channel: 'system',
    text: 'What does the function return?',
    atMs: 2,
    diarized: true,
  },
];

describe('prompt construction', () => {
  it('asks for a spoken reply and includes speaker labels', () => {
    const prompt = buildSuggestReplyPrompt(turns);

    expect(prompt.system).toMatch(/out loud/i);
    expect(prompt.system).toMatch(/do not summarize/i);
    expect(prompt.user).toContain('You: I can walk through the parser.');
    expect(prompt.user).toContain('Speaker A: What does the function return?');
  });

  it('tells the model when there is no transcript yet', () => {
    const prompt = buildSuggestReplyPrompt([]);
    expect(prompt.user).toMatch(/no transcript yet/i);
  });

  it('sends the transcript with the screenshot request and requires solution JSON', () => {
    const prompt = buildCodingPrompt(turns);

    expect(prompt.system).toContain('"isCodingProblem"');
    expect(prompt.system).toContain('"explanation"');
    expect(prompt.system).toContain('"code"');
    expect(prompt.system).toMatch(/screenshot/i);
    expect(prompt.user).toContain('Speaker A: What does the function return?');
    expect(prompt.user).toMatch(/screenshot is attached/i);
  });

  it('parses a coding solution', () => {
    expect(
      parseCodingResponse(
        JSON.stringify({
          isCodingProblem: true,
          language: 'ts',
          explanation: 'Return the sum.',
          code: 'export const add = (a: number, b: number) => a + b;',
        }),
      ),
    ).toEqual({
      isCodingProblem: true,
      language: 'ts',
      explanation: 'Return the sum.',
      code: 'export const add = (a: number, b: number) => a + b;',
    });
  });

  it('reads JSON wrapped in a markdown fence', () => {
    const parsed = parseCodingResponse(
      '```json\n{"isCodingProblem":false,"language":"","explanation":"A calendar.","code":""}\n```',
    );
    expect(parsed).toMatchObject({
      isCodingProblem: false,
      explanation: 'A calendar.',
      code: '',
    });
  });

  it('does not invent code when the response is not JSON', () => {
    const parsed = parseCodingResponse('I am not sure what is on screen.');
    expect(parsed.isCodingProblem).toBe(false);
    expect(parsed.code).toBe('');
    expect(parsed.explanation).toBe('I am not sure what is on screen.');
  });

  it('does not treat an empty code string as a solution', () => {
    const parsed = parseCodingResponse(
      '{"isCodingProblem":true,"language":"js","explanation":"Nothing to compile.","code":"  "}',
    );
    expect(parsed.isCodingProblem).toBe(false);
    expect(parsed.code).toBe('');
    expect(parsed.explanation).toBe('Nothing to compile.');
  });
});
