# Bridge

Bridge is a visible, always-on-top meeting assistant. The window stays above other apps, remains in the taskbar or dock, and is included in screen shares, screenshots, and recordings like any other window.

## What it does

- Listens to your microphone and, where the operating system allows it without a custom kernel driver, to system audio.
- Shows a live transcript. Your microphone is labeled **You** because it is a separate recording. System audio is labeled with speaker names only when Gemini can hear more than one voice in that chunk. Otherwise it stays **Mixed**. Gemini is not a dedicated diarization model, and labels can change between chunks. The window says this while you use it.
- **Ctrl+Shift+Space** sends the recent transcript to Gemini and shows a spoken reply you could say next.
- **Ctrl+Shift+C** captures the screen, sends the image plus the recent transcript to Gemini, and, when a coding problem is on screen, shows solution code, a short explanation, and a copy button.

A green **Listening** badge is on whenever the microphone is active.

## Setup

Requires Node.js 22 or newer.

```bash
npm install
cp .env.example .env
```

Edit `.env` and set your own key:

```bash
GEMINI_API_KEY=your-gemini-api-key
```

`.env` is gitignored. Do not commit it. You can also paste a key into Settings. That copy is stored in the app's user-data folder and is never written into the repository or shown again in the window.

The default model is `gemini-3.5-flash`, which accepts text, audio, and images. Override it with `GEMINI_MODEL` in `.env` or in Settings.

```bash
npm start
```

## Permissions

Bridge asks for the microphone when you press Listen. Screen capture (Ctrl+Shift+C) and system audio need screen-recording permission.

- **macOS:** System Settings → Privacy & Security → Microphone, and Screen & System Audio Recording. System audio needs macOS 13 or later. Older releases require a signed kernel extension, which Bridge does not install. Packaged apps on macOS 14.2 and later also need `NSAudioCaptureUsageDescription`; `npm start` runs as Electron, so grant Microphone and Screen Recording to Electron or the terminal that launched it.
- **Windows:** Allow microphone access when prompted. System audio uses the OS loopback path through Electron (WASAPI). No custom driver is installed.
- **Linux:** Allow microphone access. System audio depends on PipeWire or PulseAudio exposing a monitor source. Electron's loopback flag is documented as Windows-only; if Linux does not return an audio track, Bridge keeps the microphone and says system audio is unavailable.

## Shortcuts

| Action          | Default            |
| --------------- | ------------------ |
| Suggested reply | `Ctrl+Shift+Space` |
| Screen capture  | `Ctrl+Shift+C`     |

Change them in Settings, or set `BRIDGE_SUGGEST_SHORTCUT` and `BRIDGE_CAPTURE_SHORTCUT` in `.env` before a value is saved from the window. Saved settings override `.env`.

Use Electron [accelerator](https://www.electronjs.org/docs/latest/api/accelerator) syntax: one or more of `Ctrl`, `Alt`, `Shift`, `Command`, or `CommandOrControl`, then a key such as `Space`, `C`, or `F5`. Shift by itself is not accepted, and the two shortcuts must be different. On macOS, `Ctrl` is the Control key. Use `CommandOrControl` if you want Command on macOS and Ctrl on Windows and Linux.

Example:

```bash
BRIDGE_SUGGEST_SHORTCUT=CommandOrControl+Shift+Space
BRIDGE_CAPTURE_SHORTCUT=CommandOrControl+Shift+C
```

If a shortcut is already taken, Bridge says so in the window. Pick another combination and save.

## Checks

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
npm run smoke
```

`npm run verify:gemini` calls the model in `.env` for text, audio, vision, and JSON. It is local only and is not part of CI.

## Limits

- Without `GEMINI_API_KEY`, Bridge does not transcribe and does not invent speaker labels.
- A single mixed system-audio stream is labeled **Mixed** unless Gemini reports more than one distinct voice in that chunk.
- Speaker letters are not stable across chunks.
- Gemini free-tier quotas and rate limits apply. The window shows the error when a request is rejected.
- The assistant window can appear in its own screen capture. The vision prompt tells the model to ignore a window named Bridge.
