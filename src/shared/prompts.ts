import type { CodingSolution, TranscriptTurn } from './types';
import { extractJson } from './json';

export function buildSuggestReplyPrompt(turns: readonly TranscriptTurn[]): {
  system: string;
  user: string;
} {
  return {
    system: [
      'You are Bridge, a meeting assistant sitting with the user.',
      'Suggest the next thing the user could say out loud.',
      'Write it as natural spoken conversation in the first person, the way a person would actually talk.',
      'Use one to three sentences.',
      'Do not summarize the meeting, do not use bullet points, and do not add a label or quotation marks.',
      'If the transcript is empty or too thin to answer as a participant, say that in one short spoken sentence.',
    ].join(' '),
    user: `Recent transcript:\n${formatTurns(turns)}`,
  };
}

export function buildCodingPrompt(turns: readonly TranscriptTurn[]): {
  system: string;
  user: string;
} {
  return {
    system: [
      'You inspect a screenshot plus the recent meeting transcript.',
      'Decide whether the screen shows a coding problem, such as an exercise, a bug, an error, or an implementation task.',
      'Reply with JSON only, using this shape: {"isCodingProblem": boolean, "language": string, "explanation": string, "code": string}.',
      'When it is a coding problem, explanation is a few sentences of why the solution works, and code is the solution source.',
      'When it is not, set isCodingProblem to false, code to an empty string, and explanation to one or two sentences about what is on the screenshot.',
      'If a window named Bridge is visible in the screenshot, ignore it.',
    ].join(' '),
    user: `Recent transcript:\n${formatTurns(turns)}\n\nThe screenshot is attached.`,
  };
}

export function parseCodingResponse(raw: string): CodingSolution {
  const parsed = extractJson(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      isCodingProblem: false,
      language: '',
      explanation: raw.trim() || 'No response.',
      code: '',
    };
  }
  const record = parsed as Record<string, unknown>;
  const language = typeof record.language === 'string' ? record.language.trim() : '';
  const explanation =
    typeof record.explanation === 'string' && record.explanation.trim()
      ? record.explanation.trim()
      : '';
  const code = typeof record.code === 'string' ? record.code.trim() : '';
  const claimed = record.isCodingProblem === true && code.length > 0;
  return {
    isCodingProblem: claimed,
    language,
    explanation:
      explanation || (claimed ? 'Solution ready.' : 'No coding problem was found on screen.'),
    code: claimed ? code : '',
  };
}

function formatTurns(turns: readonly TranscriptTurn[]): string {
  if (turns.length === 0) return '(no transcript yet)';
  return turns.map((turn) => `${turn.speaker}: ${turn.text}`).join('\n');
}
