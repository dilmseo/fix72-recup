'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('toastwin', {
  onToast: (cb) => ipcRenderer.on('toast', (_e, d) => cb(d)),
  // Active/désactive la capture de la souris (clic-traversant hors des toasts).
  setInteractive: (on) => ipcRenderer.send('toastwin:interactive', !!on),
  open: (goto) => ipcRenderer.send('toastwin:open', goto),
  empty: () => ipcRenderer.send('toastwin:empty'),
});
