'use strict';
// ============================================================================
// Notifications système centralisées.
// Tout toast passé par ce module ouvre l'application au clic (et peut cibler un
// onglet précis via l'option `goto`). Les modules qui affichaient leurs propres
// Notification() (broadcast, commands, tunnels, ipc « notify ») passent par ici
// pour garantir ce comportement de manière uniforme.
// ============================================================================
const { Notification } = require('electron');
const toastwin = require('./toastwin');

let _win = null;
let _trayIcon = null;

// À appeler une fois la fenêtre créée (ré-appelé si la fenêtre est recréée).
function init(win, trayIcon) {
  _win = win;
  if (trayIcon) _trayIcon = trayIcon;
  // Donne au module toast maison le moyen de révéler la fenêtre principale.
  toastwin.init(reveal);
}

// Affiche la fenêtre (depuis le tray) et, si demandé, bascule sur un onglet.
function reveal(gotoView) {
  try {
    if (!_win || _win.isDestroyed()) return;
    if (!_win.isVisible()) _win.show();
    _win.focus();
    if (gotoView) _win.webContents.send('goto', gotoView);
  } catch (_) {}
}

// title, body, { icon?, goto? } — affiche notre toast maison ; repli sur la
// notification Windows native si la fenêtre-toast ne peut pas s'afficher.
function show(title, body, opts = {}) {
  if (toastwin.show(title, body, { goto: opts.goto, type: opts.type })) return null;
  try {
    if (!Notification.isSupported()) return null;
    const icon = opts.icon || (_trayIcon && _trayIcon()) || undefined;
    const n = new Notification({ title, body, icon });
    n.on('click', () => reveal(opts.goto));
    n.show();
    return n;
  } catch (_) {
    return null;
  }
}

module.exports = { init, show, reveal };
