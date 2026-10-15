export const Ipc = {
  stateGet: 'state:get',
  stateUpdated: 'state:updated',
  settingsSave: 'settings:save',
  audioChunk: 'audio:chunk',
  systemAudio: 'audio:system-status',
  listening: 'listen:set',
  suggest: 'assist:suggest',
  capture: 'assist:capture',
  clipboard: 'clipboard:write',
  windowClose: 'window:close',
  windowMinimize: 'window:minimize',
} as const;
