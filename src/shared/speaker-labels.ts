import type { Channel } from './types';

export type RawSpeakerTurn = {
  speaker?: string;
  text?: string;
};

export type LabeledSpeakerTurn = {
  speaker: string;
  text: string;
  diarized: boolean;
};

export type SpeakerLabelResult = {
  diarized: boolean;
  turns: LabeledSpeakerTurn[];
  note: string | null;
};

export function labelSpeakerTurns(
  channel: Channel,
  raw: { diarized?: boolean; turns?: RawSpeakerTurn[] } | null,
): SpeakerLabelResult {
  const turns = (raw?.turns ?? [])
    .map((turn) => ({
      speaker: (turn.speaker ?? '').trim().replace(/\s+/g, ' '),
      text: (turn.text ?? '').trim().replace(/\s+/g, ' '),
    }))
    .filter((turn) => turn.text.length > 0);

  if (turns.length === 0) {
    return { diarized: false, turns: [], note: null };
  }

  const distinct = new Set(turns.map((turn) => turn.speaker || 'Unknown'));
  const separated = raw?.diarized === true && distinct.size >= 2;

  if (channel === 'microphone') {
    if (!separated) {
      return {
        diarized: false,
        note: null,
        turns: [
          {
            speaker: 'You',
            text: turns.map((turn) => turn.text).join(' '),
            diarized: false,
          },
        ],
      };
    }
    return {
      diarized: true,
      note: 'More than one voice was reported on the microphone in this chunk.',
      turns: turns.map((turn) => ({
        speaker:
          turn.speaker.toLowerCase() === 'you' ? 'You' : `Mic · ${turn.speaker || 'Unknown'}`,
        text: turn.text,
        diarized: true,
      })),
    };
  }

  if (!separated) {
    return {
      diarized: false,
      note: 'System audio is one mixed stream. Speakers were not separated in this chunk, so it stays Mixed.',
      turns: [
        {
          speaker: 'Mixed',
          text: turns.map((turn) => turn.text).join(' '),
          diarized: false,
        },
      ],
    };
  }

  return {
    diarized: true,
    note: 'Speaker labels apply to this chunk only. Letters may change on the next chunk.',
    turns: turns.map((turn) => ({
      speaker: formatSystemSpeaker(turn.speaker),
      text: turn.text,
      diarized: true,
    })),
  };
}

function formatSystemSpeaker(speaker: string): string {
  const name = speaker || 'Unknown';
  if (/^speaker\s/i.test(name)) return name.replace(/^speaker/i, 'Speaker');
  return `Speaker ${name}`;
}
