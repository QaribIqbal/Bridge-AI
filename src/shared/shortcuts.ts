export const DEFAULT_SUGGEST_SHORTCUT = 'CommandOrControl+Shift+Space';
export const DEFAULT_CAPTURE_SHORTCUT = 'CommandOrControl+Shift+C';

const MODIFIER_ORDER = [
  'CommandOrControl',
  'Ctrl',
  'Command',
  'Alt',
  'Meta',
  'Super',
  'Shift',
] as const;

const MODIFIER_ALIASES: Record<string, (typeof MODIFIER_ORDER)[number]> = {
  ctrl: 'Ctrl',
  control: 'Ctrl',
  commandorcontrol: 'CommandOrControl',
  cmdorctrl: 'CommandOrControl',
  command: 'Command',
  cmd: 'Command',
  alt: 'Alt',
  option: 'Alt',
  meta: 'Meta',
  super: 'Super',
  shift: 'Shift',
};

const PRIMARY_MODIFIERS = new Set(['Ctrl', 'Command', 'CommandOrControl', 'Alt', 'Meta', 'Super']);

const NAMED_KEYS = new Set([
  'Space',
  'Tab',
  'Enter',
  'Escape',
  'Up',
  'Down',
  'Left',
  'Right',
  'Plus',
  'Minus',
  'Backspace',
  'Delete',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Insert',
]);

export type ShortcutPair =
  { ok: true; suggest: string; capture: string } | { ok: false; error: string };

export function normalizeShortcut(raw: string): string | null {
  const parts = raw
    .trim()
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;

  const modifiers: Array<(typeof MODIFIER_ORDER)[number]> = [];
  let key = '';
  for (const part of parts) {
    const alias = MODIFIER_ALIASES[part.toLowerCase()];
    if (alias) {
      if (!modifiers.includes(alias)) modifiers.push(alias);
      continue;
    }
    if (key) return null;
    key = canonicalKey(part);
    if (!key) return null;
  }

  if (!key || modifiers.length === 0) return null;
  if (!modifiers.some((modifier) => PRIMARY_MODIFIERS.has(modifier))) return null;

  const ordered = MODIFIER_ORDER.filter((modifier) => modifiers.includes(modifier));
  return [...ordered, key].join('+');
}

export function validateShortcutPair(suggestRaw: string, captureRaw: string): ShortcutPair {
  const suggest = normalizeShortcut(suggestRaw);
  if (!suggest) {
    return {
      ok: false,
      error: 'Suggest reply shortcut needs a modifier such as Ctrl, Alt, or Command, plus a key.',
    };
  }
  const capture = normalizeShortcut(captureRaw);
  if (!capture) {
    return {
      ok: false,
      error: 'Screen capture shortcut needs a modifier such as Ctrl, Alt, or Command, plus a key.',
    };
  }
  if (suggest.toLowerCase() === capture.toLowerCase()) {
    return { ok: false, error: 'The two shortcuts must be different.' };
  }
  return { ok: true, suggest, capture };
}

function canonicalKey(part: string): string {
  if (/^[a-z0-9]$/i.test(part)) return part.toUpperCase();
  const named = [...NAMED_KEYS].find((key) => key.toLowerCase() === part.toLowerCase());
  if (named) return named;
  const functionKey = part.match(/^f(\d{1,2})$/i);
  if (functionKey) {
    const number = Number(functionKey[1]);
    if (number >= 1 && number <= 24) return `F${number}`;
  }
  return '';
}
