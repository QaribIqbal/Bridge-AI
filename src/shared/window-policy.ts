export const windowPolicy = {
  alwaysOnTop: true,
  skipTaskbar: false,
  transparent: false,
  frame: false,
  show: true,
  title: 'Bridge',
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  },
} as const;
