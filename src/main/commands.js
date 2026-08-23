'use strict';
// ============================================================================
// Sondage des commandes ciblées déposées depuis l'admin fix72.
// Jumeau de broadcast.js, mais ADRESSÉ à CE poste (par machine_id) : quand
// Etienne clique « Ouvrir un canal » sur ce poste dans l'admin, une commande
// 'open_channel' apparaît ici → l'app ouvre son tunnel toute seule (avec un
// simple avis à l'écran client) et renvoie le port à Etienne.
// Toujours silencieux : un échec réseau ne doit jamais perturber l'app.
// ============================================================================
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const notify = require('./notify');
const license = require('./license');
const assistance = require('./assistance');
const tunnels = require('./tunnels');

// Projet ordi-facile (même base que présence/broadcast). Clé anon publique.
const SUPABASE_URL = 'https://juqxtwqwzhtermlesoaj.supabase.co';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1cXh0d3F3emh0ZXJtbGVzb2FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MjUxMTksImV4cCI6MjA5MzIwMTExOX0.gQWLqJTO4WpOBAIZbui5U81XW6DSdLWzS81u-JF3WsQ';

const INTERVAL_MS = 12 * 1000; // latence max ~12 s
let busy = false;              // évite d'empiler deux ouvertures
let timer = null;

function stateFile() { return path.join(app.getPath('userData'), 'commands.json'); }
function lastId() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')).lastId || 0; } catch (_) { return 0; }
}
function setLastId(id) {
  try { fs.writeFileSync(stateFile(), JSON.stringify({ lastId: id })); } catch (_) {}
}

async function poll(win, trayIcon) {
  if (busy) return;
  let mid;
  try { mid = await license.machineId(); } catch (_) { return; }
  if (!mid) return;

  let cmds;
  try {
    const res = await fetch(SUPABASE_URL + '/rest/v1/rpc/remote_command_latest', {
      method: 'POST',
      headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_machine: mid, p_since: lastId() }),
    });
    cmds = await res.json();
  } catch (_) { return; }
  if (!Array.isArray(cmds) || !cmds.length) return;

  // Le serveur a déjà marqué ces commandes consommées ; on avance quand même
  // notre lastId local en garde-fou (redémarrage, double instance…).
  let max = lastId();
  for (const c of cmds) { if ((c.id || 0) > max) max = c.id; }
  setLastId(max);

  // On agit sur la commande la plus récente (ouvrir OU fermer un canal).
  const cmd = cmds
    .filter((c) => c && (c.command === 'open_channel' || c.command === 'close_channel'))
    .sort((a, b) => (b.id || 0) - (a.id || 0))[0];
  if (!cmd) return;

  busy = true;
  try {
    if (cmd.command === 'open_channel') {
      notify.show(
        'FIX72 — Assistance à distance',
        "Votre technicien FIX72 ouvre une session d'assistance en toute sécurité…",
        { goto: 'assistance' }
      );
      if (win && !win.isDestroyed()) win.webContents.send('remote-open-channel');
      const r = await assistance.openChannelForAdmin('Ouverture demandée depuis l’admin fix72');
      // Remontée immédiate du tunnel à l'admin (sans attendre le tick ~10 s).
      if (r && r.ok && r.port) { try { await tunnels.reportOpen(r.port); } catch (_) {} }
    } else { // close_channel
      await assistance.closeSession();
      await tunnels.reportClose();
      if (win && !win.isDestroyed()) win.webContents.send('remote-close-channel');
    }
  } catch (_) { /* silencieux */ }
  finally { busy = false; }
}

function start(win, trayIcon) {
  if (timer) return;
  setTimeout(() => poll(win, trayIcon), 8000); // premier sondage après le boot
  timer = setInterval(() => poll(win, trayIcon), INTERVAL_MS);
  if (timer.unref) timer.unref();
}

module.exports = { start };
