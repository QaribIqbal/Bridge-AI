/** Flash-Lite has the larger free-tier quota and accepts text, audio, and images. */
export const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

const LOW_QUOTA_MODELS = new Set(['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.7-flash']);

export function normalizeModel(raw: string | undefined): string {
  let name = raw?.trim() ?? '';
  name = name.replace(/^models\//i, '');
  if (/^emini-/i.test(name)) name = `g${name}`;
  if (!/^gemini-[a-z0-9._-]{1,80}$/i.test(name)) return DEFAULT_MODEL;
  if (LOW_QUOTA_MODELS.has(name)) return DEFAULT_MODEL;
  return name;
}
