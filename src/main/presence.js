'use strict';
// ============================================================================
// Battement de présence (« heartbeat »).
// Signale périodiquement à ordi-facile que ce poste tourne, pour que l'admin
// fix72 sache « qui a l'antivirus en ligne ». Clé = machine_id stable (le même
// hash MachineGuid que la licence / les crédits). Couvre free ET pro.
// Toujours silencieux : un échec réseau ne doit jamais perturber l'app.
// ============================================================================
const os = require('os');
const { app } = require('electron');
const license = require('./license');
const owner = require('./owner');

// Projet ordi-facile (même base que les licences). Clé anon publique par nature.
const SUPABASE_URL = 'https://juqxtwqwzhtermlesoaj.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1cXh0d3F3emh0ZXJtbGVzb2FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MjUxMTksImV4cCI6MjA5MzIwMTExOX0.gQWLqJTO4WpOBAIZbui5U81XW6DSdLWzS81u-JF3WsQ';

const INTERVAL_MS = 60 * 1000; // 1 min
let timer = null;

async function beat() {
  try {
    const mid = await license.machineId();
    let pro = false;
    try { const st = await license.getState(); pro = !!(st && st.pro); } catch (_) {}
    await fetch(SUPABASE_URL + '/rest/v1/rpc/app_heartbeat', {
      method: 'POST',
      headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_machine: mid,
        p_label: os.hostname(),
        p_pro: pro,
        p_version: app.getVersion(),
        p_owner: owner.fullName() || null,
      }),
    });
  } catch (_) { /* silencieux */ }
}

function start() {
  if (timer) return;
  beat(); // premier battement immédiat
  timer = setInterval(beat, INTERVAL_MS);
  if (timer.unref) timer.unref();
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
}

// Force un battement immédiat (ex. juste après la saisie du nom).
function beatNow() { beat(); }

module.exports = { start, stop, beatNow };
