import { DEFAULT_MODEL } from './models';
import {
  DEFAULT_CAPTURE_SHORTCUT,
  DEFAULT_SUGGEST_SHORTCUT,
  validateShortcutPair,
} from './shortcuts';
import type { KeySource } from './types';

export type StoredSettings = {
  geminiApiKey?: string;
  model?: string;
  suggestShortcut?: string;
  captureShortcut?: string;
};

export type ResolvedSettings = {
  geminiApiKey: string;
  model: string;
  suggestShortcut: string;
  captureShortcut: string;
  keySource: KeySource;
};

export function resolveSettings(
  env: Record<string, string | undefined>,
  saved: StoredSettings | null,
): ResolvedSettings {
  const savedKey = saved?.geminiApiKey?.trim() ?? '';
  const envKey = env.GEMINI_API_KEY?.trim() ?? '';
  const geminiApiKey = savedKey || envKey;
  const keySource: KeySource = savedKey ? 'saved' : envKey ? 'env' : 'missing';
  const shortcuts = chooseShortcuts(saved, env);
  const model = firstText(saved?.model, env.GEMINI_MODEL, DEFAULT_MODEL);
  return {
    geminiApiKey,
    model,
    suggestShortcut: shortcuts.suggest,
    captureShortcut: shortcuts.capture,
    keySource,
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
    if (savedPair.ok) return { suggest: savedPair.suggest, capture: savedPair.capture };
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
