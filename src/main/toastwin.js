'use strict';
// ============================================================================
// Fenêtre-toast maison : remplace les notifications Windows natives (qu'on ne
// peut pas redessiner) par une petite fenêtre sans bordure, transparente,
// toujours au-dessus, ancrée en bas à droite de l'écran principal. Elle
// s'affiche même quand la fenêtre principale est réduite/fermée.
//   - clic sur « + » (bleu)  -> ouvre l'application (callback reveal)
//   - clic sur « × » (rouge) -> ferme le toast
//   - disparition automatique au bout de 10 s
// Le rendu vit dans renderer/toastwin.html (design identique aux toasts in-app).
// ============================================================================
const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

let _win = null;
let _ready = false;
let _reveal = null;      // function(goto) : montre l'app principale
const _buffer = [];      // toasts reçus avant que la fenêtre soit prête

// Injecté par notify.init : comment révéler la fenêtre principale.
function init(revealFn) {
  _reveal = revealFn;
}

function position() {
  if (!_win || _win.isDestroyed()) return;
  const { workArea } = screen.getPrimaryDisplay();
  const [w, h] = _win.getSize();
  const margin = 16;
  _win.setBounds({
    x: workArea.x + workArea.width - w - margin,
    y: workArea.y + workArea.height - h - margin,
    width: w,
    height: h,
  });
}

function ensureWin() {
  if (_win && !_win.isDestroyed()) return _win;
  _ready = false;
  _win = new BrowserWindow({
    width: 424,
    height: 600,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    fullscreenable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    acceptFirstMouse: true,
    webPreferences: {
      preload: path.join(__dirname, 'toastwin-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  _win.setAlwaysOnTop(true, 'screen-saver');
  try { _win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch (_) {}
  // Fenêtre traversée par la souris par défaut ; le renderer réactive le clic
  // uniquement quand le pointeur survole un toast.
  _win.setIgnoreMouseEvents(true, { forward: true });
  _win.webContents.once('did-finish-load', () => {
    _ready = true;
    position();
    while (_buffer.length) send(_buffer.shift());
  });
  _win.on('closed', () => { _win = null; _ready = false; });
  _win.loadFile(path.join(__dirname, '..', 'renderer', 'toastwin.html'));
  return _win;
}

function send(payload) {
  if (!_win || _win.isDestroyed()) return;
  _win.showInactive();          // visible sans voler le focus
  _win.setAlwaysOnTop(true, 'screen-saver');
  _win.webContents.send('toast', payload);
}

// title, body, { goto? } — renvoie true si le toast maison a été programmé.
function show(title, body, opts = {}) {
  try {
    ensureWin();
    const payload = { title: title || '', body: body || '', goto: opts.goto || null, kind: opts.type || null };
    if (_ready) send(payload);
    else _buffer.push(payload);
    return true;
  } catch (_) {
    return false;
  }
}

// --- IPC venant du renderer de la fenêtre-toast -----------------------------
ipcMain.on('toastwin:interactive', (_e, on) => {
  if (_win && !_win.isDestroyed()) _win.setIgnoreMouseEvents(!on, { forward: true });
});
ipcMain.on('toastwin:open', (_e, goto) => {
  if (_reveal) _reveal(goto || null);
});
ipcMain.on('toastwin:empty', () => {
  if (_win && !_win.isDestroyed()) _win.hide();
});

module.exports = { init, show };
