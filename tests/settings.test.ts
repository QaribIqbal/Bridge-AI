import { describe, expect, it } from 'vitest';
import { resolveSettings } from '../src/shared/settings';
import { DEFAULT_MODEL } from '../src/shared/models';

describe('settings resolution', () => {
  it('reads the Gemini key from the environment when nothing is saved', () => {
    const resolved = resolveSettings({ GEMINI_API_KEY: 'env-key' }, null);

    expect(resolved.geminiApiKey).toBe('env-key');
    expect(resolved.keySource).toBe('env');
    expect(DEFAULT_MODEL).toBe('gemini-3.5-flash');
    expect(resolved.model).toBe(DEFAULT_MODEL);
    expect(resolved.suggestShortcut).toBe('Ctrl+Shift+Space');
    expect(resolved.captureShortcut).toBe('Ctrl+Shift+C');
  });

  it('lets a saved key and valid shortcuts override the environment', () => {
    const resolved = resolveSettings(
      {
        GEMINI_API_KEY: 'env-key',
        BRIDGE_SUGGEST_SHORTCUT: 'Ctrl+Shift+A',
        GEMINI_MODEL: 'gemini-2.5-flash',
      },
      {
        geminiApiKey: 'saved-key',
        suggestShortcut: 'Ctrl+Alt+Space',
        captureShortcut: 'Ctrl+Alt+C',
        model: 'gemini-3.5-flash',
      },
    );

    expect(resolved.geminiApiKey).toBe('saved-key');
    expect(resolved.keySource).toBe('saved');
    expect(resolved.suggestShortcut).toBe('Ctrl+Alt+Space');
    expect(resolved.captureShortcut).toBe('Ctrl+Alt+C');
    expect(resolved.model).toBe('gemini-3.5-flash');
  });

  it('falls back when a saved shortcut pair is invalid', () => {
    const resolved = resolveSettings(
      { BRIDGE_SUGGEST_SHORTCUT: 'Ctrl+Shift+A', BRIDGE_CAPTURE_SHORTCUT: 'Ctrl+Shift+B' },
      { suggestShortcut: 'Ctrl+Shift+X', captureShortcut: 'Ctrl+Shift+X' },
    );

    expect(resolved.suggestShortcut).toBe('Ctrl+Shift+A');
    expect(resolved.captureShortcut).toBe('Ctrl+Shift+B');
    expect(resolved.keySource).toBe('missing');
    expect(resolved.geminiApiKey).toBe('');
  });

  it('ignores a blank saved key and uses the env key', () => {
    const resolved = resolveSettings({ GEMINI_API_KEY: ' env-key ' }, { geminiApiKey: '   ' });
    expect(resolved.geminiApiKey).toBe('env-key');
    expect(resolved.keySource).toBe('env');
  });
});
