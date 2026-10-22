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

export type SttEngine = 'openai' | 'gemini' | 'none';

export type SystemAudioStatus = 'idle' | 'capturing' | 'unavailable';

export type PublicState = {
  listening: boolean;
  micActive: boolean;
  systemAudio: SystemAudioStatus;
  /** Gemini key source — used for suggest / screen (and slow STT fallback). */
  keySource: KeySource;
  geminiKeySource: KeySource;
  openaiKeySource: KeySource;
  sttEngine: SttEngine;
  model: string;
  openaiTranscribeModel: string;
  suggestShortcut: string;
  captureShortcut: string;
  turns: TranscriptTurn[];
  suggestion: string;
  solution: CodingSolution | null;
  status: string;
  banner: string;
  engineStatus: string;
  systemAudioDetail: string;
};

export type SettingsInput = {
  model?: string;
  suggestShortcut?: string;
  captureShortcut?: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
};

export type AudioChunk = {
  channel: Channel;
  mimeType: string;
  data: Uint8Array;
  atMs: number;
};
