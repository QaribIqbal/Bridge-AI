import { describe, expect, it } from 'vitest';
import { resolveSettings } from '../src/shared/settings';
import { DEFAULT_MODEL } from '../src/shared/models';
import { DEFAULT_OPENAI_TRANSCRIBE_MODEL } from '../src/shared/stt';

describe('settings resolution', () => {
  it('prefers OpenAI for STT when both keys are present', () => {
    const resolved = resolveSettings(
      { GEMINI_API_KEY: 'env-gemini', OPENAI_API_KEY: 'env-openai' },
      null,
    );

    expect(resolved.openaiApiKey).toBe('env-openai');
    expect(resolved.geminiApiKey).toBe('env-gemini');
    expect(resolved.sttEngine).toBe('openai');
    expect(resolved.openaiKeySource).toBe('env');
    expect(resolved.geminiKeySource).toBe('env');
    expect(resolved.keySource).toBe('env');
    expect(DEFAULT_MODEL).toBe('gemini-3.5-flash-lite');
    expect(resolved.model).toBe(DEFAULT_MODEL);
    expect(resolved.openaiTranscribeModel).toBe(DEFAULT_OPENAI_TRANSCRIBE_MODEL);
    expect(resolved.suggestShortcut).toBe('CommandOrControl+Shift+Space');
    expect(resolved.captureShortcut).toBe('CommandOrControl+Shift+C');
  });

  it('falls back to Gemini STT when only Gemini is configured', () => {
    const resolved = resolveSettings({ GEMINI_API_KEY: 'env-key' }, null);
    expect(resolved.sttEngine).toBe('gemini');
    expect(resolved.openaiKeySource).toBe('missing');
  });

  it('repairs a mistyped model and the old low-quota default', () => {
    const typo = resolveSettings({}, { model: 'emini-3.5-flash-lite', geminiApiKey: 'saved-key' });
    const routed = resolveSettings({}, { model: 'gemini-3.6-flash', geminiApiKey: 'saved-key' });

    expect(typo.model).toBe('gemini-3.5-flash-lite');
    expect(routed.model).toBe('gemini-3.5-flash-lite');
  });

  it('moves the original Mac shortcuts onto Command', () => {
    const resolved = resolveSettings(
      {},
      { suggestShortcut: 'Ctrl+Shift+Space', captureShortcut: 'Ctrl+Shift+C' },
    );

    expect(resolved.suggestShortcut).toBe('CommandOrControl+Shift+Space');
    expect(resolved.captureShortcut).toBe('CommandOrControl+Shift+C');
  });

  it('lets a saved key and valid shortcuts override the environment', () => {
    const resolved = resolveSettings(
      {
        GEMINI_API_KEY: 'env-key',
        OPENAI_API_KEY: 'env-openai',
        BRIDGE_SUGGEST_SHORTCUT: 'Ctrl+Shift+A',
        GEMINI_MODEL: 'gemini-2.5-flash',
      },
      {
        geminiApiKey: 'saved-key',
        openaiApiKey: 'saved-openai',
        suggestShortcut: 'Ctrl+Alt+Space',
        captureShortcut: 'Ctrl+Alt+C',
        model: 'gemini-3.5-flash',
      },
    );

    expect(resolved.geminiApiKey).toBe('saved-key');
    expect(resolved.openaiApiKey).toBe('saved-openai');
    expect(resolved.keySource).toBe('saved');
    expect(resolved.openaiKeySource).toBe('saved');
    expect(resolved.sttEngine).toBe('openai');
    expect(resolved.suggestShortcut).toBe('Ctrl+Alt+Space');
    expect(resolved.captureShortcut).toBe('Ctrl+Alt+C');
    expect(resolved.model).toBe('gemini-3.5-flash-lite');
  });

  it('falls back when a saved shortcut pair is invalid', () => {
    const resolved = resolveSettings(
      { BRIDGE_SUGGEST_SHORTCUT: 'Ctrl+Shift+A', BRIDGE_CAPTURE_SHORTCUT: 'Ctrl+Shift+B' },
      { suggestShortcut: 'Ctrl+Shift+X', captureShortcut: 'Ctrl+Shift+X' },
    );

    expect(resolved.suggestShortcut).toBe('Ctrl+Shift+A');
    expect(resolved.captureShortcut).toBe('Ctrl+Shift+B');
    expect(resolved.keySource).toBe('missing');
    expect(resolved.sttEngine).toBe('none');
    expect(resolved.geminiApiKey).toBe('');
  });

  it('ignores a blank saved key and uses the env key', () => {
    const resolved = resolveSettings(
      { GEMINI_API_KEY: ' env-key ', OPENAI_API_KEY: ' env-openai ' },
      { geminiApiKey: '   ', openaiApiKey: '   ' },
    );
    expect(resolved.geminiApiKey).toBe('env-key');
    expect(resolved.openaiApiKey).toBe('env-openai');
    expect(resolved.keySource).toBe('env');
    expect(resolved.openaiKeySource).toBe('env');
  });
});
