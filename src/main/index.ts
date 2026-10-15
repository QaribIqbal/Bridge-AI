import {
  app,
  BrowserWindow,
  clipboard,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  session,
} from 'electron';
import path from 'node:path';
import { Assistant, parseAudioChunk } from './assistant';
import { capturePrimaryScreen } from './capture';
import { loadProjectEnv, readStoredSettings, writeStoredSettings } from './settings-file';
import { createBridgeWindow } from './window';
import { Ipc } from '../shared/ipc';
import { resolveSettings, type StoredSettings } from '../shared/settings';
import { validateShortcutPair } from '../shared/shortcuts';
import type { PublicState, SettingsInput } from '../shared/types';

const smoke = process.argv.includes('--smoke');

app.setName('Bridge');

const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
}

let mainWindow: BrowserWindow | null = null;
let assistant: Assistant | null = null;

if (hasInstanceLock) {
  void app.whenReady().then(boot);
}

async function boot(): Promise<void> {
  if (smoke) {
    setTimeout(() => {
      console.error('smoke timed out');
      app.exit(1);
    }, 8000);
  }
  installCaptureHandlers();
  const env = loadProjectEnv();
  const stored = readStoredSettings();
  assistant = new Assistant(resolveSettings(env, stored), publish, capturePrimaryScreen);
  registerShortcuts();

  const win = createBridgeWindow(path.join(__dirname, 'preload.js'));
  mainWindow = win;
  win.on('closed', () => {
    mainWindow = null;
  });

  ipcMain.handle(Ipc.stateGet, () => assistant?.snapshot());
  ipcMain.handle(Ipc.settingsSave, (_event, input: unknown) => saveSettings(env, input));
  ipcMain.handle(Ipc.audioChunk, (_event, input: unknown) => {
    const chunk = parseAudioChunk(input);
    if (!chunk || !assistant) return { ok: false };
    assistant.enqueueAudio(chunk);
    return { ok: true };
  });
  ipcMain.handle(Ipc.systemAudio, (_event, status: unknown) => {
    if (status === 'capturing' || status === 'unavailable') assistant?.setSystemAudio(status);
  });
  ipcMain.handle(Ipc.listening, (_event, listening: unknown) => {
    assistant?.setListening(listening === true);
  });
  ipcMain.handle(Ipc.suggest, () => assistant?.suggestReply());
  ipcMain.handle(Ipc.capture, () => assistant?.solveFromScreen());
  ipcMain.handle(Ipc.clipboard, (_event, text: unknown) => {
    if (typeof text === 'string') clipboard.writeText(text.slice(0, 100_000));
  });
  ipcMain.handle(Ipc.windowClose, () => mainWindow?.close());
  ipcMain.handle(Ipc.windowMinimize, () => mainWindow?.minimize());

  if (smoke) {
    win.webContents.on('console-message', (event) => {
      if (event.level !== 'error' && event.level !== 'warning') return;
      if (!event.message.includes('AIza')) console.error(`renderer: ${event.message}`);
    });
  }

  try {
    await win.loadFile(path.join(__dirname, 'index.html'));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Bridge failed to load.');
    app.exit(1);
    return;
  }

  if (smoke) {
    try {
      win.show();
      const bridgeReady = await win.webContents.executeJavaScript(
        'typeof window.bridge === "object" && typeof window.bridge.getState === "function"',
      );
      const rawState = await win.webContents.executeJavaScript(
        'window.bridge.getState().then((state) => JSON.stringify(state))',
      );
      const state = JSON.parse(String(rawState)) as {
        suggestShortcut?: string;
        captureShortcut?: string;
        banner?: string;
      };
      const leaked = String(rawState).includes('AIza');
      if (
        bridgeReady !== true ||
        leaked ||
        state.suggestShortcut !== 'Ctrl+Shift+Space' ||
        state.captureShortcut !== 'Ctrl+Shift+C' ||
        !state.banner
      ) {
        console.error('preload did not expose a safe Bridge state');
        app.exit(1);
        return;
      }
      console.log(
        JSON.stringify({
          ready: true,
          title: win.getTitle(),
          alwaysOnTop: win.isAlwaysOnTop(),
          visible: win.isVisible(),
          bridge: true,
          suggestShortcut: state.suggestShortcut,
          captureShortcut: state.captureShortcut,
        }),
      );
      app.exit(0);
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'smoke failed');
      app.exit(1);
    }
    return;
  }

  publish(assistant.snapshot());
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  app.quit();
});

function publish(state: PublicState): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(Ipc.stateUpdated, state);
  }
}

function registerShortcuts(): void {
  if (!assistant) return;
  globalShortcut.unregisterAll();
  const state = assistant.snapshot();
  const suggestOk = globalShortcut.register(state.suggestShortcut, () => {
    void assistant?.suggestReply();
  });
  const captureOk = globalShortcut.register(state.captureShortcut, () => {
    void assistant?.solveFromScreen();
  });
  const warning = [
    suggestOk ? '' : `Could not register ${state.suggestShortcut}. Change it in Settings.`,
    captureOk ? '' : `Could not register ${state.captureShortcut}. Change it in Settings.`,
  ]
    .filter(Boolean)
    .join(' ');
  assistant.setShortcutWarning(warning);
}

function saveSettings(
  env: Record<string, string | undefined>,
  input: unknown,
): { ok: true } | { ok: false; error: string } {
  if (!assistant || !input || typeof input !== 'object') {
    return { ok: false, error: 'Settings were not valid.' };
  }
  const raw = input as SettingsInput;
  const current = assistant.snapshot();
  const pair = validateShortcutPair(
    typeof raw.suggestShortcut === 'string' ? raw.suggestShortcut : current.suggestShortcut,
    typeof raw.captureShortcut === 'string' ? raw.captureShortcut : current.captureShortcut,
  );
  if (!pair.ok) return pair;
  const model =
    typeof raw.model === 'string' && raw.model.trim() ? raw.model.trim() : current.model;
  if (!/^[a-zA-Z0-9._-]{1,80}$/.test(model)) {
    return { ok: false, error: 'Model name is not valid.' };
  }
  const stored: StoredSettings = {
    ...(readStoredSettings() ?? {}),
    model,
    suggestShortcut: pair.suggest,
    captureShortcut: pair.capture,
  };
  if (typeof raw.geminiApiKey === 'string' && raw.geminiApiKey.trim()) {
    stored.geminiApiKey = raw.geminiApiKey.trim();
  }
  writeStoredSettings(stored);
  assistant.setSettings(resolveSettings(env, stored));
  registerShortcuts();
  return { ok: true };
}

function installCaptureHandlers(): void {
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer
      .getSources({ types: ['screen'] })
      .then((sources) => {
        const source = sources[0];
        if (!source) {
          callback(null);
          return;
        }
        callback({
          video: { id: source.id, name: source.name },
          audio: 'loopback',
        });
      })
      .catch(() => callback(null));
  });

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media' || permission === 'display-capture');
  });
}
