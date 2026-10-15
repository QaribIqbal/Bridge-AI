import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { Ipc } from '../shared/ipc';
import type { PublicState, SettingsInput } from '../shared/types';

export type AudioChunkMessage = {
  channel: 'microphone' | 'system';
  mimeType: string;
  bytes: ArrayBuffer;
  atMs: number;
};

const api = {
  getState: (): Promise<PublicState> => ipcRenderer.invoke(Ipc.stateGet),
  saveSettings: (input: SettingsInput): Promise<{ ok: true } | { ok: false; error: string }> =>
    ipcRenderer.invoke(Ipc.settingsSave, input),
  submitAudioChunk: (chunk: AudioChunkMessage): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(Ipc.audioChunk, chunk),
  reportSystemAudio: (status: 'capturing' | 'unavailable'): Promise<void> =>
    ipcRenderer.invoke(Ipc.systemAudio, status),
  setListening: (listening: boolean): Promise<void> => ipcRenderer.invoke(Ipc.listening, listening),
  suggestReply: (): Promise<void> => ipcRenderer.invoke(Ipc.suggest),
  solveFromScreen: (): Promise<void> => ipcRenderer.invoke(Ipc.capture),
  copyText: (text: string): Promise<void> => ipcRenderer.invoke(Ipc.clipboard, text),
  closeWindow: (): Promise<void> => ipcRenderer.invoke(Ipc.windowClose),
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke(Ipc.windowMinimize),
  onState: (listener: (state: PublicState) => void): (() => void) => {
    const wrapped = (_event: IpcRendererEvent, state: PublicState): void => listener(state);
    ipcRenderer.on(Ipc.stateUpdated, wrapped);
    return () => ipcRenderer.removeListener(Ipc.stateUpdated, wrapped);
  },
};

contextBridge.exposeInMainWorld('bridge', api);

export type BridgeApi = typeof api;
