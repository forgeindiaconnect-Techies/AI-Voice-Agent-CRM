/// <reference types="vite/client" />

export interface IElectronAPI {
  isElectron: boolean;
  getAppVersion: () => Promise<string>;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  isMaximized: () => Promise<boolean>;
  showNotification: (title: string, body: string) => void;
  openExternal: (url: string) => void;
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI;
  }
}
