'use strict';
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const updater = require('./updater');
const notify = require('./notify');
const owner = require('./owner');
const presence = require('./presence');
const commands = require('./commands');
const tunnels = require('./tunnels');
const assistance = require('./assistance');
const recovery = require('./recovery');
const { runRaw } = require('./ps');

let win = null;
let tray = null;
let isQuitting = false;

const APP_TITLE = 'FIX72 Récup Compte';
const TASK_NAME = 'FIX72 Recup Compte';

// Instance unique
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (!win.isVisible()) win.show(); win.focus(); }
  });
}

async function isAdmin() {
  try {
    const out = await runRaw('([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)');
    return /true/i.test(out);
  } catch (_) { return false; }
}

function trayIcon() {
  const ico = path.join(__dirname, '..', '..', 'build', 'icon.ico');
  if (fs.existsSync(ico)) return nativeImage.createFromPath(ico);
  const png = path.join(__dirname, '..', 'renderer', 'assets', 'logo.png');
  if (fs.existsSync(png)) {
    let img = nativeImage.createFromPath(png);
    if (!img.isEmpty()) img = img.resize({ width: 16, height: 16 });
    return img;
  }
  return nativeImage.createEmpty();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1180, height: 780, minWidth: 960, minHeight: 660,
    show: false, frame: false, backgroundColor: '#070b17', autoHideMenuBar: true,
    icon: trayIcon(), title: APP_TITLE,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  notify.init(win, trayIcon);
  win.once('ready-to-show', () => { if (!process.argv.includes('--hidden')) win.show(); });
  win.on('minimize', (e) => { e.preventDefault(); win.hide(); });
  win.on('close', (e) => { if (!isQuitting) { e.preventDefault(); win.hide(); } });
}

async function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip(APP_TITLE);
  await refreshTrayMenu();
  tray.on('double-click', () => { win.show(); win.focus(); });
}

async function refreshTrayMenu() {
  const auto = await getAutoLaunch();
  const menu = Menu.buildFromTemplate([
    { label: 'Ouvrir ' + APP_TITLE, click: () => { win.show(); win.focus(); } },
    { type: 'separator' },
    { label: 'Lancer au démarrage de Windows', type: 'checkbox', checked: auto, click: async (item) => { await setAutoLaunch(item.checked); refreshTrayMenu(); } },
    { type: 'separator' },
    { label: 'Quitter', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
}

// --- Démarrage auto via tâche planifiée (pas d'UAC au login) ----------------
async function getAutoLaunch() {
  try {
    const out = await runRaw(`if (Get-ScheduledTask -TaskName '${TASK_NAME}' -ErrorAction SilentlyContinue) { 'yes' } else { 'no' }`);
    return /yes/i.test(out);
  } catch (_) { return false; }
}

async function setAutoLaunch(enabled) {
  const exe = process.execPath.replace(/'/g, "''");
  if (enabled) {
    const cmd =
      `$a = New-ScheduledTaskAction -Execute '${exe}' -Argument '--hidden';` +
      `$t = New-ScheduledTaskTrigger -AtLogOn;` +
      `$p = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\\$env:USERNAME" -RunLevel Highest;` +
      `$s = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable;` +
      `$s.ExecutionTimeLimit = 'PT0S';` +
      `Register-ScheduledTask -TaskName '${TASK_NAME}' -Action $a -Trigger $t -Principal $p -Settings $s -Force | Out-Null`;
    await runRaw(cmd).catch(() => {});
  } else {
    await runRaw(`Unregister-ScheduledTask -TaskName '${TASK_NAME}' -Confirm:$false -ErrorAction SilentlyContinue`).catch(() => {});
  }
  return getAutoLaunch();
}

// Exclut la prise en main à distance de Windows Defender (ngrok + dossier de
// travail), sinon Defender met ngrok en quarantaine et la session reste bloquée.
// UNE exclusion par appel (l'enchaînement est classé Trojan PowExcEnv par Defender).
async function ensureRemoteSupportExcluded() {
  if (!app.isPackaged) return;
  const NS = 'root/Microsoft/Windows/Defender';
  const esc = (s) => String(s).replace(/'/g, "''");
  const la = process.env.LOCALAPPDATA || '';
  const excl = [
    ['ExclusionProcess', 'ngrok.exe'],
    ['ExclusionProcess', 'FIX72 Recup Compte.exe'],
    ['ExclusionPath', 'C:\\ProgramData\\Fix72'],
    ['ExclusionPath', 'C:\\Users\\*\\AppData\\Local\\FIX72'],
  ];
  if (la) excl.push(['ExclusionPath', la + '\\FIX72']);
  for (const [key, val] of excl) {
    await runRaw(
      `Invoke-CimMethod -Namespace '${NS}' -ClassName MSFT_MpPreference -MethodName Add -Arguments @{${key}=[string[]]@('${esc(val)}')} -EA SilentlyContinue | Out-Null`
    ).catch(() => {});
  }
}

app.whenReady().then(async () => {
  createWindow();
  await createTray();

  await ensureRemoteSupportExcluded();

  if (!(await getAutoLaunch())) { await setAutoLaunch(true); refreshTrayMenu(); }

  if (app.isPackaged) updater.init(win);

  presence.start();               // « en ligne » dans l'admin fix72
  commands.start(win, trayIcon);  // « Ouvrir un canal » depuis l'admin
  tunnels.start();                // report état tunnel + fermeture auto > 1 h

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { /* on garde l'app dans la zone de notification */ });

app.on('before-quit', () => {
  isQuitting = true;
  try { if (tray) { tray.destroy(); tray = null; } } catch (_) {}
});

// ============================ IPC ==========================================
function bindCall(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    try { return { ok: true, data: await fn(...args) }; }
    catch (err) { return { ok: false, error: err.message || String(err) }; }
  });
}

bindCall('sys:isAdmin', () => isAdmin());
bindCall('sys:relaunchAdmin', async () => {
  const exe = process.execPath;
  const argv = process.defaultApp ? [path.resolve(process.argv[1] || '.')] : [];
  const psArgs = argv.length ? `-ArgumentList '${argv.join("','")}'` : '';
  await runRaw(`Start-Process -FilePath '${exe.replace(/'/g, "''")}' ${psArgs} -Verb RunAs`);
  isQuitting = true;
  setTimeout(() => app.quit(), 400);
  return true;
});

bindCall('app:version', () => app.getVersion());
bindCall('app:checkUpdate', () => { updater.check(); return true; });
bindCall('app:installUpdate', () => updater.installManual());
bindCall('app:getAutoLaunch', () => getAutoLaunch());
bindCall('app:setAutoLaunch', async (v) => { const r = await setAutoLaunch(!!v); refreshTrayMenu(); return r; });

bindCall('shell:openExternal', (url) => { shell.openExternal(url); return true; });

bindCall('owner:get', () => owner.get());
bindCall('owner:set', async (firstName, lastName) => { const saved = owner.set(firstName, lastName); presence.beatNow(); return saved; });

// Récupération de compte
bindCall('recup:priceInfo', () => recovery.priceInfo());
bindCall('recup:payAndHelp', (context) => recovery.payAndHelp(context, win));

// Assistance directe (utilisée au téléphone, sans paiement automatique)
bindCall('assistance:takeover', () => assistance.startTakeover());
bindCall('assistance:closeSession', async () => { const r = await assistance.closeSession(); tunnels.reportClose(); return r; });
bindCall('assistance:sessionState', () => assistance.sessionState());

// Chat
bindCall('chat:start', (name, firstMessage, context) => assistance.chatStart(name, firstMessage, context));
bindCall('chat:send', (sessionId, content) => assistance.chatSend(sessionId, content));
bindCall('chat:poll', (sessionId) => assistance.chatPoll(sessionId));

// Notifications système (clic → ouvre l'app)
ipcMain.on('notify', (e, title, body) => notify.show(title, body));

// Contrôles de fenêtre
ipcMain.on('win:show', () => { if (!win) return; if (win.isMinimized()) win.restore(); if (!win.isVisible()) win.show(); win.focus(); });
ipcMain.on('win:minimize', () => win && win.hide());
ipcMain.on('win:close', () => win && win.hide());
ipcMain.on('win:maximize', () => { if (!win) return; if (win.isMaximized()) win.unmaximize(); else win.maximize(); });
