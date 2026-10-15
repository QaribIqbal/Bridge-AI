import type { CodingSolution, PublicState, TranscriptTurn } from '../shared/types';

const listeningText = document.querySelector<HTMLElement>('#listening-text');
const listeningBadge = document.querySelector<HTMLElement>('#listening');
const listenButton = document.querySelector<HTMLButtonElement>('#listen-toggle');
const banner = document.querySelector<HTMLElement>('#banner');
const audioStatus = document.querySelector<HTMLElement>('#audio-status');
const localError = document.querySelector<HTMLElement>('#local-error');
const transcript = document.querySelector<HTMLElement>('#transcript');
const suggestionBody = document.querySelector<HTMLElement>('#suggestion-body');
const suggestKey = document.querySelector<HTMLElement>('#suggest-key');
const captureKey = document.querySelector<HTMLElement>('#capture-key');
const solution = document.querySelector<HTMLElement>('#solution');
const solutionExplanation = document.querySelector<HTMLElement>('#solution-explanation');
const solutionCode = document.querySelector<HTMLElement>('#solution-code');
const copyButton = document.querySelector<HTMLButtonElement>('#copy');
const statusLine = document.querySelector<HTMLElement>('#status');
const settings = document.querySelector<HTMLElement>('#settings');
const settingsForm = document.querySelector<HTMLFormElement>('#settings-form');
const settingsError = document.querySelector<HTMLElement>('#settings-error');
const keyStatus = document.querySelector<HTMLElement>('#key-status');
const modelInput = document.querySelector<HTMLInputElement>('#model');
const suggestInput = document.querySelector<HTMLInputElement>('#suggest-shortcut');
const captureInput = document.querySelector<HTMLInputElement>('#capture-shortcut');
const apiKeyInput = document.querySelector<HTMLInputElement>('#api-key');

let micStream: MediaStream | null = null;
let systemStream: MediaStream | null = null;
const recorders: MediaRecorder[] = [];
let latestSolution: CodingSolution | null = null;

function requireElement<T extends Element>(element: T | null, name: string): T {
  if (!element) throw new Error(`Missing ${name}`);
  return element;
}

function setListeningIndicator(active: boolean): void {
  requireElement(listeningBadge, 'listening badge').classList.toggle('on', active);
  requireElement(listeningBadge, 'listening badge').classList.toggle('off', !active);
  requireElement(listeningText, 'listening text').textContent = active
    ? 'Listening'
    : 'Not listening';
  requireElement(listenButton, 'listen button').textContent = active ? 'Stop' : 'Listen';
}

function renderTurns(turns: readonly TranscriptTurn[]): void {
  const root = requireElement(transcript, 'transcript');
  root.replaceChildren();
  if (turns.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Press Listen. What you say shows up here.';
    root.append(empty);
    return;
  }
  for (const turn of turns) {
    const row = document.createElement('article');
    const who = document.createElement('span');
    who.className = 'speaker';
    who.textContent = turn.speaker;
    const text = document.createElement('p');
    text.textContent = turn.text;
    row.append(who, text);
    root.append(row);
  }
  root.scrollTop = root.scrollHeight;
}

function renderSolution(next: CodingSolution | null): void {
  latestSolution = next;
  const panel = requireElement(solution, 'solution');
  const explanation = requireElement(solutionExplanation, 'explanation');
  const code = requireElement(solutionCode, 'code');
  const copy = requireElement(copyButton, 'copy');
  if (!next) {
    panel.hidden = false;
    explanation.textContent = 'Press Read screen when a coding problem is visible.';
    code.hidden = true;
    copy.hidden = true;
    code.textContent = '';
    return;
  }
  panel.hidden = false;
  explanation.textContent = next.explanation;
  const hasCode = next.code.length > 0;
  code.hidden = !hasCode;
  copy.hidden = !hasCode;
  code.textContent = next.code;
  copy.textContent = 'Copy code';
}

function showLocalError(message: string): void {
  const node = requireElement(localError, 'local error');
  node.hidden = message.length === 0;
  node.textContent = message;
}

function applyState(state: PublicState): void {
  setListeningIndicator(state.micActive);
  requireElement(banner, 'banner').textContent = state.banner;
  const audio = requireElement(audioStatus, 'audio status');
  audio.hidden = state.systemAudioDetail.trim().length === 0;
  audio.textContent = state.systemAudioDetail;
  requireElement(suggestionBody, 'suggestion').textContent =
    state.suggestion || 'Press Suggest when you want a line to say.';
  requireElement(suggestKey, 'suggest key').textContent = state.suggestShortcut;
  requireElement(captureKey, 'capture key').textContent = state.captureShortcut;
  const status = requireElement(statusLine, 'status');
  status.hidden = state.status.trim().length === 0;
  status.textContent = state.status;
  requireElement(keyStatus, 'key status').textContent = keyLabel(state.keySource);
  renderTurns(state.turns);
  renderSolution(state.solution);
  if (document.activeElement !== modelInput) {
    requireElement(modelInput, 'model').value = state.model;
  }
  if (document.activeElement !== suggestInput) {
    requireElement(suggestInput, 'suggest').value = state.suggestShortcut;
  }
  if (document.activeElement !== captureInput) {
    requireElement(captureInput, 'capture').value = state.captureShortcut;
  }
}

function keyLabel(source: PublicState['keySource']): string {
  if (source === 'env') return 'API key: loaded from .env. It is not shown here.';
  if (source === 'saved') return 'API key: saved in app data. It is not shown here.';
  return 'API key: missing. Add GEMINI_API_KEY to .env.';
}

function recorderFor(stream: MediaStream): MediaRecorder {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  const mimeType = candidates.find((item) => MediaRecorder.isTypeSupported(item));
  return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
}

let recording = false;

function record(stream: MediaStream, channel: 'microphone' | 'system'): void {
  const run = (): void => {
    if (!recording) return;
    if (!stream.getTracks().some((track) => track.readyState === 'live')) return;
    const recorder = recorderFor(stream);
    recorders.push(recorder);
    recorder.addEventListener('dataavailable', (event) => {
      void sendChunk(event.data, channel);
    });
    recorder.addEventListener('stop', () => {
      const index = recorders.indexOf(recorder);
      if (index >= 0) recorders.splice(index, 1);
      if (recording) run();
    });
    // Stop and restart so every blob is a complete file. A timeslice after the
    // first chunk is only a fragment, and Gemini rejects that as an invalid argument.
    recorder.start();
    window.setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, 5_000);
  };
  run();
}

async function sendChunk(blob: Blob, channel: 'microphone' | 'system'): Promise<void> {
  if (blob.size < 800) return;
  const bytes = await blob.arrayBuffer();
  const mimeType = (blob.type || 'audio/webm').split(';')[0] || 'audio/webm';
  await window.bridge.submitAudioChunk({ channel, mimeType, bytes, atMs: Date.now() });
}

async function startListening(): Promise<void> {
  recording = true;
  showLocalError('');
  const mic = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video: false,
  });
  micStream = mic;
  const track = mic.getAudioTracks()[0];
  const refresh = (): void => {
    const live = Boolean(track && track.readyState === 'live' && track.enabled && !track.muted);
    setListeningIndicator(live);
  };
  track?.addEventListener('ended', refresh);
  track?.addEventListener('mute', refresh);
  track?.addEventListener('unmute', refresh);
  refresh();
  await window.bridge.setListening(true);
  record(mic, 'microphone');
  await startSystemAudio();
}

async function startSystemAudio(): Promise<void> {
  try {
    const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const audioTracks = display.getAudioTracks();
    if (audioTracks.length === 0) {
      display.getTracks().forEach((item) => item.stop());
      await window.bridge.reportSystemAudio('unavailable');
      return;
    }
    systemStream = display;
    record(new MediaStream(audioTracks), 'system');
    await window.bridge.reportSystemAudio('capturing');
  } catch {
    await window.bridge.reportSystemAudio('unavailable');
  }
}

async function stopListening(): Promise<void> {
  recording = false;
  for (const recorder of recorders) {
    if (recorder.state !== 'inactive') recorder.stop();
  }
  recorders.length = 0;
  micStream?.getTracks().forEach((track) => track.stop());
  systemStream?.getTracks().forEach((track) => track.stop());
  micStream = null;
  systemStream = null;
  setListeningIndicator(false);
  await window.bridge.setListening(false);
}

requireElement(listenButton, 'listen button').addEventListener('click', () => {
  void (async () => {
    try {
      if (micStream) await stopListening();
      else await startListening();
    } catch (error) {
      setListeningIndicator(false);
      await window.bridge.setListening(false);
      showLocalError(
        error instanceof Error
          ? error.message
          : 'Microphone permission is required before Bridge can listen.',
      );
    }
  })();
});

requireElement(document.querySelector('#settings-toggle'), 'settings toggle').addEventListener(
  'click',
  () => {
    const panel = requireElement(settings, 'settings');
    panel.hidden = !panel.hidden;
  },
);

requireElement(document.querySelector('#settings-close'), 'settings close').addEventListener(
  'click',
  () => {
    requireElement(settings, 'settings').hidden = true;
  },
);

requireElement(settingsForm, 'settings form').addEventListener('submit', (event) => {
  event.preventDefault();
  void (async () => {
    const result = await window.bridge.saveSettings({
      model: requireElement(modelInput, 'model').value,
      suggestShortcut: requireElement(suggestInput, 'suggest').value,
      captureShortcut: requireElement(captureInput, 'capture').value,
      geminiApiKey: requireElement(apiKeyInput, 'api key').value,
    });
    const error = requireElement(settingsError, 'settings error');
    if (!result.ok) {
      error.hidden = false;
      error.textContent = result.error;
      return;
    }
    error.hidden = true;
    requireElement(apiKeyInput, 'api key').value = '';
    requireElement(settings, 'settings').hidden = true;
  })();
});

requireElement(document.querySelector('#suggest'), 'suggest').addEventListener('click', () => {
  void window.bridge.suggestReply();
});

requireElement(document.querySelector('#capture'), 'capture').addEventListener('click', () => {
  void window.bridge.solveFromScreen();
});

requireElement(copyButton, 'copy').addEventListener('click', () => {
  if (!latestSolution?.code) return;
  void window.bridge.copyText(latestSolution.code).then(() => {
    requireElement(copyButton, 'copy').textContent = 'Copied';
  });
});

requireElement(document.querySelector('#close'), 'close').addEventListener('click', () => {
  void window.bridge.closeWindow();
});

requireElement(document.querySelector('#minimize'), 'minimize').addEventListener('click', () => {
  void window.bridge.minimizeWindow();
});

window.bridge.onState(applyState);
void window.bridge.getState().then(applyState);
