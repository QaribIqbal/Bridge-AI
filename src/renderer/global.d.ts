import type { BridgeApi } from '../preload/preload';

declare global {
  interface Window {
    bridge: BridgeApi;
  }
}

export {};
