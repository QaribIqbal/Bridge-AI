import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CAPTURE_SHORTCUT,
  DEFAULT_SUGGEST_SHORTCUT,
  normalizeShortcut,
  validateShortcutPair,
} from '../src/shared/shortcuts';

describe('shortcut config', () => {
  it('defaults to Ctrl+Shift+Space and Ctrl+Shift+C', () => {
    expect(DEFAULT_SUGGEST_SHORTCUT).toBe('CommandOrControl+Shift+Space');
    expect(DEFAULT_CAPTURE_SHORTCUT).toBe('CommandOrControl+Shift+C');
  });

  it('normalizes modifier aliases and key case', () => {
    expect(normalizeShortcut(' control + shift + space ')).toBe('Ctrl+Shift+Space');
    expect(normalizeShortcut('ctrl+shift+c')).toBe('Ctrl+Shift+C');
    expect(normalizeShortcut('CmdOrCtrl+Alt+F5')).toBe('CommandOrControl+Alt+F5');
  });

  it('rejects shortcuts that are too easy to hit by accident', () => {
    expect(normalizeShortcut('')).toBeNull();
    expect(normalizeShortcut('Space')).toBeNull();
    expect(normalizeShortcut('Shift+Space')).toBeNull();
    expect(normalizeShortcut('Ctrl+Shift')).toBeNull();
    expect(normalizeShortcut('Ctrl+Nope')).toBeNull();
  });

  it('accepts a valid pair and rejects duplicates', () => {
    expect(validateShortcutPair('Ctrl+Shift+Space', 'Ctrl+Shift+C')).toEqual({
      ok: true,
      suggest: 'Ctrl+Shift+Space',
      capture: 'Ctrl+Shift+C',
    });

    expect(validateShortcutPair('ctrl+shift+c', 'Ctrl+Shift+C')).toEqual({
      ok: false,
      error: 'The two shortcuts must be different.',
    });
  });

  it('explains an invalid shortcut', () => {
    const result = validateShortcutPair('C', 'Ctrl+Shift+C');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Suggest reply/);
    }
  });
});
