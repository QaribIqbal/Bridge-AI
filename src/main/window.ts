import { BrowserWindow } from 'electron';
import { windowPolicy } from '../shared/window-policy';

// Normal OS window: on top, in the taskbar or dock, and included in screen capture.
export function createBridgeWindow(preloadPath: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 420,
    height: 700,
    minWidth: 360,
    minHeight: 520,
    backgroundColor: '#101218',
    autoHideMenuBar: true,
    title: windowPolicy.title,
    alwaysOnTop: windowPolicy.alwaysOnTop,
    skipTaskbar: windowPolicy.skipTaskbar,
    transparent: windowPolicy.transparent,
    frame: windowPolicy.frame,
    show: windowPolicy.show,
    webPreferences: {
      ...windowPolicy.webPreferences,
      preload: preloadPath,
    },
  });
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setTitle(windowPolicy.title);
  return win;
}
