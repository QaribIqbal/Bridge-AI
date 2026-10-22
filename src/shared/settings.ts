import { DEFAULT_MODEL, normalizeModel } from './models';
import {
  DEFAULT_CAPTURE_SHORTCUT,
  DEFAULT_SUGGEST_SHORTCUT,
  validateShortcutPair,
} from './shortcuts';
import { DEFAULT_OPENAI_TRANSCRIBE_MODEL, normalizeOpenAiTranscribeModel } from './stt';
import type { KeySource, SttEngine } from './types';

export type StoredSettings = {
  geminiApiKey?: string;
  openaiApiKey?: string;
  model?: string;
  openaiTranscribeModel?: string;
  suggestShortcut?: string;
  captureShortcut?: string;
};

export type ResolvedSettings = {
  geminiApiKey: string;
  openaiApiKey: string;
  model: string;
  openaiTranscribeModel: string;
  suggestShortcut: string;
  captureShortcut: string;
  geminiKeySource: KeySource;
  openaiKeySource: KeySource;
  /** Gemini key source (suggest / screen / slow STT fallback). */
  keySource: KeySource;
  sttEngine: SttEngine;
};

export function resolveSettings(
  env: Record<string, string | undefined>,
  saved: StoredSettings | null,
): ResolvedSettings {
  const savedGemini = saved?.geminiApiKey?.trim() ?? '';
  const envGemini = env.GEMINI_API_KEY?.trim() ?? '';
  const geminiApiKey = savedGemini || envGemini;
  const geminiKeySource: KeySource = savedGemini ? 'saved' : envGemini ? 'env' : 'missing';

  const savedOpenAi = saved?.openaiApiKey?.trim() ?? '';
  const envOpenAi = env.OPENAI_API_KEY?.trim() ?? '';
  const openaiApiKey = savedOpenAi || envOpenAi;
  const openaiKeySource: KeySource = savedOpenAi ? 'saved' : envOpenAi ? 'env' : 'missing';

  const shortcuts = chooseShortcuts(saved, env);
  const model = normalizeModel(firstText(saved?.model, env.GEMINI_MODEL, DEFAULT_MODEL));
  const openaiTranscribeModel = normalizeOpenAiTranscribeModel(
    firstText(
      saved?.openaiTranscribeModel,
      env.OPENAI_TRANSCRIBE_MODEL,
      DEFAULT_OPENAI_TRANSCRIBE_MODEL,
    ),
  );

  const sttEngine: SttEngine = openaiApiKey ? 'openai' : geminiApiKey ? 'gemini' : 'none';

  return {
    geminiApiKey,
    openaiApiKey,
    model,
    openaiTranscribeModel,
    suggestShortcut: shortcuts.suggest,
    captureShortcut: shortcuts.capture,
    geminiKeySource,
    openaiKeySource,
    keySource: geminiKeySource,
    sttEngine,
  };
}

function chooseShortcuts(
  saved: StoredSettings | null,
  env: Record<string, string | undefined>,
): { suggest: string; capture: string } {
  if (saved?.suggestShortcut || saved?.captureShortcut) {
    const savedPair = validateShortcutPair(
      saved.suggestShortcut ?? DEFAULT_SUGGEST_SHORTCUT,
      saved.captureShortcut ?? DEFAULT_CAPTURE_SHORTCUT,
    );
    if (savedPair.ok) {
      if (savedPair.suggest === 'Ctrl+Shift+Space' && savedPair.capture === 'Ctrl+Shift+C') {
        return { suggest: DEFAULT_SUGGEST_SHORTCUT, capture: DEFAULT_CAPTURE_SHORTCUT };
      }
      return { suggest: savedPair.suggest, capture: savedPair.capture };
    }
  }
  const envPair = validateShortcutPair(
    env.BRIDGE_SUGGEST_SHORTCUT ?? DEFAULT_SUGGEST_SHORTCUT,
    env.BRIDGE_CAPTURE_SHORTCUT ?? DEFAULT_CAPTURE_SHORTCUT,
  );
  if (envPair.ok) return { suggest: envPair.suggest, capture: envPair.capture };
  return { suggest: DEFAULT_SUGGEST_SHORTCUT, capture: DEFAULT_CAPTURE_SHORTCUT };
}

function firstText(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return DEFAULT_MODEL;
}
