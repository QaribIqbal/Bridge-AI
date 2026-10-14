export type Channel = 'microphone' | 'system';

export type TranscriptTurn = {
  id: string;
  speaker: string;
  channel: Channel;
  text: string;
  atMs: number;
  diarized: boolean;
};

export type CodingSolution = {
  isCodingProblem: boolean;
  language: string;
  explanation: string;
  code: string;
};

export type KeySource = 'saved' | 'env' | 'missing';

export type SystemAudioStatus = 'idle' | 'capturing' | 'unavailable';

export type PublicState = {
  listening: boolean;
  micActive: boolean;
  systemAudio: SystemAudioStatus;
  keySource: KeySource;
  model: string;
  suggestShortcut: string;
  captureShortcut: string;
  turns: TranscriptTurn[];
  suggestion: string;
  solution: CodingSolution | null;
  status: string;
  banner: string;
  systemAudioDetail: string;
};

export type SettingsInput = {
  model?: string;
  suggestShortcut?: string;
  captureShortcut?: string;
  geminiApiKey?: string;
};

export type AudioChunk = {
  channel: Channel;
  mimeType: string;
  data: Uint8Array;
  atMs: number;
};
