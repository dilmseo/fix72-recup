'use strict';
// ============================================================================
// Reporter de tunnels d'assistance : signale à ordi-facile l'état du canal de
// CE poste (ouvert / vivant / fermé) pour que l'admin le voie et puisse le
// fermer, SANS dépendre de Telegram. Ferme aussi AUTOMATIQUEMENT tout tunnel
// ouvert depuis plus d'1 h (garde-fou oubli/crash côté technicien).
// Source de vérité = channel_status.json (via assistance.channelInfo()).
// ============================================================================
const license = require('./license');
const assistance = require('./assistance');
const notify = require('./notify');

const SUPABASE_URL = 'https://juqxtwqwzhtermlesoaj.supabase.co';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1cXh0d3F3emh0ZXJtbGVzb2FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MjUxMTksImV4cCI6MjA5MzIwMTExOX0.gQWLqJTO4WpOBAIZbui5U81XW6DSdLWzS81u-JF3WsQ';

const INTERVAL_MS = 10 * 1000;
const MAX_TUNNEL_MS = 60 * 60 * 1000; // fermeture auto au-delà d'1 h

let timer = null;
let reportedOpen = false;
let reportedPort = null;
let activeSince = 0;
let deadStreak = 0;   // ticks consécutifs où channel_status dit « actif » mais le listener est muet

async function rpc(fn, body) {
  try {
    await fetch(SUPABASE_URL + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (_) { /* silencieux */ }
}

async function tick() {
  let mid;
  try { mid = await license.machineId(); } catch (_) { return; }
  if (!mid) return;

  const info = assistance.channelInfo();
  if (info.active) {
    // channel_status.json peut MENTIR (canal mort sans nettoyage) → on vérifie que
    // le listener 127.0.0.1:8765 répond vraiment avant de le signaler « actif ».
    const alive = await assistance.listenerAlive();
    if (!alive) {
      deadStreak++;
      if (deadStreak >= 2) { // ~20 s de silence → tunnel fantôme, on nettoie
        assistance.clearChannelStatus();
        if (reportedOpen) { await rpc('remote_tunnel_close', { p_machine: mid }); }
        reportedOpen = false; reportedPort = null; activeSince = 0; deadStreak = 0;
      }
      return;
    }
    deadStreak = 0;
    if (!activeSince) activeSince = Date.now();

    // Garde-fou : au-delà d'1 h, on ferme tout seul (tue ngrok + canal).
    if (Date.now() - activeSince > MAX_TUNNEL_MS) {
      try { await assistance.closeSession(); } catch (_) {}
      await rpc('remote_tunnel_close', { p_machine: mid });
      notify.show(
        'FIX72 — Assistance à distance',
        "Session d'assistance fermée automatiquement (durée maximale d'1 h atteinte).",
        { goto: 'assistance' }
      );
      reportedOpen = false; reportedPort = null; activeSince = 0;
      return;
    }

    if (!reportedOpen || reportedPort !== info.port) {
      await rpc('remote_tunnel_open', { p_machine: mid, p_port: info.port });
      reportedOpen = true; reportedPort = info.port;
    } else {
      await rpc('remote_tunnel_ping', { p_machine: mid });
    }
  } else {
    if (reportedOpen) {
      await rpc('remote_tunnel_close', { p_machine: mid });
      reportedOpen = false; reportedPort = null;
    }
    activeSince = 0;
  }
}

// Signale IMMÉDIATEMENT l'ouverture d'un canal (dès que l'app en a confirmé un
// vivant), pour que l'admin le voie sans attendre le prochain tick (~10 s).
async function reportOpen(port) {
  let mid;
  try { mid = await license.machineId(); } catch (_) { return; }
  if (!mid || !port) return;
  await rpc('remote_tunnel_open', { p_machine: mid, p_port: String(port) });
  reportedOpen = true; reportedPort = String(port);
  if (!activeSince) activeSince = Date.now();
}

// Signale immédiatement la fermeture (ex. clôture manuelle ou ordre admin).
async function reportClose() {
  let mid;
  try { mid = await license.machineId(); } catch (_) { return; }
  if (!mid) return;
  await rpc('remote_tunnel_close', { p_machine: mid });
  reportedOpen = false; reportedPort = null; activeSince = 0;
}

function start() {
  if (timer) return;
  setTimeout(tick, 6000);
  timer = setInterval(tick, INTERVAL_MS);
  if (timer.unref) timer.unref();
}

module.exports = { start, reportOpen, reportClose };
