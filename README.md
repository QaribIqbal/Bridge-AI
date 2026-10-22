# Bridge

Bridge is a visible, always-on-top meeting assistant. The window stays above other apps, remains in the taskbar or dock, and is included in screen shares, screenshots, and recordings like any other window.

## Mac app

Tagged releases include an Apple silicon zip and an Intel zip. Unzip, then double-click `Open Bridge.command`. That clears the download flag, signs the app on your Mac, and opens it. Paste your keys in Settings the first time. Keys stay on this Mac.

## What it does

- Listens to your microphone and, where the operating system allows it without a custom kernel driver, to system audio.
- Shows a near-real-time transcript when `OPENAI_API_KEY` is set. Bridge records short complete webm chunks (~2.5s) and sends each to OpenAI `audio/transcriptions` (`gpt-4o-mini-transcribe` by default). A latest-only queue drops stale chunks so the UI stays on live speech.
- Labels are honest: microphone → **You**; system audio → **Mixed**. OpenAI STT does not return speakers here. The Gemini audio fallback may report multiple voices in a chunk; otherwise it stays Mixed.
- **Suggest**, or Command+Shift+Space on a Mac, asks Gemini (text only) for a spoken reply you could say next.
- **Read screen**, or Command+Shift+C on a Mac, sends a screenshot to Gemini vision and, for a coding problem, shows solution code and a copy button.

A green **Listening** badge is on whenever the microphone is active.

## Setup

Requires Node.js 22 or newer.

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```bash
OPENAI_API_KEY=your-openai-api-key
GEMINI_API_KEY=your-gemini-api-key
```

| Key                       | Used for                                                              |
| ------------------------- | --------------------------------------------------------------------- |
| `OPENAI_API_KEY`          | Live transcript (`gpt-4o-mini-transcribe` / `whisper-1`)              |
| `GEMINI_API_KEY`          | Suggest reply + Read screen; slow audio fallback if OpenAI is missing |
| `OPENAI_TRANSCRIBE_MODEL` | Optional STT model override                                           |
| `GEMINI_MODEL`            | Optional Gemini model for assist / vision                             |

`.env` is gitignored. Do not commit it. You can also paste keys into Settings. That copy is stored in the app's user-data folder and is never written into the repository or shown again in the window.

Without `OPENAI_API_KEY`, Bridge can still transcribe with Gemini audio, but the window warns that path is minutes behind live speech. Prefer OpenAI for meetings.

The default Gemini model is `gemini-3.5-flash-lite`. Override with `GEMINI_MODEL` in `.env` or in Settings.

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

`npm run verify:gemini` calls the Gemini model in `.env` for text, vision, and JSON. `npm run verify:stt` calls OpenAI transcription when `OPENAI_API_KEY` is set. Both are local only and are not part of CI.

## Limits

- Without `OPENAI_API_KEY` and without `GEMINI_API_KEY`, Bridge does not transcribe.
- Gemini-only transcription is a slow fallback; the UI says so.
- A single mixed system-audio stream is labeled **Mixed** unless a model reports more than one distinct voice in that chunk (Gemini fallback only).
- Speaker letters from the Gemini fallback are not stable across chunks.
- OpenAI and Gemini quotas and rate limits apply. The window shows the error when a request is rejected.
- The assistant window can appear in its own screen capture. The vision prompt tells the model to ignore a window named Bridge.
