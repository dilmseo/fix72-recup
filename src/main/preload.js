'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('recup', {
  // Système
  isAdmin: () => ipcRenderer.invoke('sys:isAdmin'),
  relaunchAdmin: () => ipcRenderer.invoke('sys:relaunchAdmin'),
  version: () => ipcRenderer.invoke('app:version'),
  checkUpdate: () => ipcRenderer.invoke('app:checkUpdate'),
  installUpdate: () => ipcRenderer.invoke('app:installUpdate'),
  onUpdateEvent: (cb) => ipcRenderer.on('update:event', (_e, data) => cb(data)),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  getAutoLaunch: () => ipcRenderer.invoke('app:getAutoLaunch'),
  setAutoLaunch: (v) => ipcRenderer.invoke('app:setAutoLaunch', v),

  // Propriétaire du poste (nom / prénom)
  ownerGet: () => ipcRenderer.invoke('owner:get'),
  ownerSet: (firstName, lastName) => ipcRenderer.invoke('owner:set', firstName, lastName),

  // Récupération de compte : paiement + prise en main
  priceInfo: () => ipcRenderer.invoke('recup:priceInfo'),
  payAndHelp: (context) => ipcRenderer.invoke('recup:payAndHelp', context),

  // Assistance à distance (prise en main directe, sans paiement — usage tel.)
  assistanceTakeover: () => ipcRenderer.invoke('assistance:takeover'),
  assistanceCloseSession: () => ipcRenderer.invoke('assistance:closeSession'),
  assistanceSessionState: () => ipcRenderer.invoke('assistance:sessionState'),

  // Chat en direct
  chatStart: (name, firstMessage, context) => ipcRenderer.invoke('chat:start', name, firstMessage, context),
  chatSend: (sessionId, content) => ipcRenderer.invoke('chat:send', sessionId, content),
  chatPoll: (sessionId) => ipcRenderer.invoke('chat:poll', sessionId),

  // Événements
  onGoto: (cb) => ipcRenderer.on('goto', (_e, view) => cb(view)),
  onRemoteOpenChannel: (cb) => ipcRenderer.on('remote-open-channel', cb),
  onRemoteCloseChannel: (cb) => ipcRenderer.on('remote-close-channel', cb),
  notify: (title, body) => ipcRenderer.send('notify', title, body),

  // Contrôles de fenêtre
  winShow: () => ipcRenderer.send('win:show'),
  winMinimize: () => ipcRenderer.send('win:minimize'),
  winMaximize: () => ipcRenderer.send('win:maximize'),
  winClose: () => ipcRenderer.send('win:close'),
});
