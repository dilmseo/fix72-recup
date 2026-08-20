'use strict';
// Auto-update via GitHub Releases (dépôt public dilmseo/fix72-recup).
// Le provider est injecté dans app-update.yml par electron-builder (champ "publish").
const { autoUpdater } = require('electron-updater');
const { dialog, app, BrowserWindow, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const APP_NAME = 'FIX72 Récup Compte';
let mainWindow = null;
let manualCheck = false;
let downloadedFile = null;

function pendingInstaller() {
  if (downloadedFile && fs.existsSync(downloadedFile)) return downloadedFile;
  try {
    const dir = path.join(app.getPath('appData'), '..', 'Local', 'fix72-recup-updater', 'pending');
    const exe = fs.readdirSync(dir).find((f) => /\.exe$/i.test(f));
    if (exe) return path.join(dir, exe);
  } catch (_) {}
  return null;
}

function installManual() {
  const exe = pendingInstaller();
  if (!exe) return { ok: false, error: 'Installeur introuvable.' };
  shell.openPath(exe).catch(() => {});
  return { ok: true };
}

function forceInstall() {
  try { app.removeAllListeners('window-all-closed'); } catch (_) {}
  try { BrowserWindow.getAllWindows().forEach((w) => { try { w.removeAllListeners('close'); } catch (_) {} }); } catch (_) {}
  setTimeout(() => { try { installManual(); } catch (_) {} }, 6000);
  setImmediate(() => { try { autoUpdater.quitAndInstall(true, true); } catch (_) { installManual(); } });
}

function send(event, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update:event', { event, payload });
}

function init(win) {
  mainWindow = win;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => send('checking'));
  autoUpdater.on('update-available', (info) => send('available', { version: info.version }));
  autoUpdater.on('update-not-available', () => {
    send('none');
    if (manualCheck) { manualCheck = false; dialog.showMessageBox(mainWindow, { type: 'info', title: APP_NAME, message: 'Vous êtes déjà à la dernière version.' }); }
  });
  autoUpdater.on('download-progress', (p) => send('progress', { percent: Math.round(p.percent) }));
  autoUpdater.on('error', (err) => {
    send('error', { message: String(err && err.message ? err.message : err) });
    if (manualCheck) { manualCheck = false; dialog.showMessageBox(mainWindow, { type: 'error', title: APP_NAME, message: 'Échec de la vérification des mises à jour.', detail: String(err && err.message ? err.message : err) }); }
  });
  autoUpdater.on('update-downloaded', async (info) => {
    downloadedFile = (info && info.downloadedFile) || downloadedFile;
    send('downloaded', { version: info.version });
    const r = await dialog.showMessageBox(mainWindow, {
      type: 'question', buttons: ['Redémarrer maintenant', 'Plus tard'], defaultId: 0, cancelId: 1,
      title: 'Mise à jour prête', message: `${APP_NAME} ${info.version} est prêt à être installé.`,
      detail: 'L’application va redémarrer pour terminer la mise à jour.',
    });
    if (r.response === 0) forceInstall();
  });

  setTimeout(() => safeCheck(false), 8000);
  setInterval(() => safeCheck(false), 6 * 60 * 60 * 1000);
}

function safeCheck(isManual) {
  manualCheck = isManual;
  autoUpdater.checkForUpdates().catch((err) => send('error', { message: String(err) }));
}

module.exports = { init, check: () => safeCheck(true), installManual };
