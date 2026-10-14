import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnvFile } from '../shared/env-file';
import type { StoredSettings } from '../shared/settings';

export function loadProjectEnv(): Record<string, string | undefined> {
  const merged: Record<string, string | undefined> = { ...process.env };
  for (const file of [path.join(process.cwd(), '.env'), path.join(app.getAppPath(), '.env')]) {
    if (!existsSync(file)) continue;
    Object.assign(merged, parseEnvFile(readFileSync(file, 'utf8')));
  }
  return merged;
}

export function settingsFilePath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

export function readStoredSettings(): StoredSettings | null {
  const file = settingsFilePath();
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as StoredSettings;
  } catch {
    return null;
  }
}

export function writeStoredSettings(settings: StoredSettings): void {
  const file = settingsFilePath();
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(settings, null, 2), { mode: 0o600 });
}
