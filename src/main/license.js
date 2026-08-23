'use strict';
// Gestion de la licence Fix72 Antivirus (Pro).
// L'app parle aux Edge Functions Supabase (jamais directement à la table).
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');
const { runRaw } = require('./ps');

const SUPABASE_URL = 'https://juqxtwqwzhtermlesoaj.supabase.co';
// Clé anon (publique par nature) — sert uniquement d'en-tête d'accès aux fonctions.
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1cXh0d3F3emh0ZXJtbGVzb2FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MjUxMTksImV4cCI6MjA5MzIwMTExOX0.gQWLqJTO4WpOBAIZbui5U81XW6DSdLWzS81u-JF3WsQ';
const FN = SUPABASE_URL + '/functions/v1';
const BUY_URL = 'https://fix72.com/licence-antivirus';

let cachedMachineId = null;
function cacheFile() {
  return path.join(app.getPath('userData'), 'license.json');
}

async function machineId() {
  if (cachedMachineId) return cachedMachineId;
  let guid = '';
  try {
    guid = (await runRaw(
      "(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography' -Name MachineGuid).MachineGuid"
    )).trim();
  } catch (_) {}
  if (!guid) guid = os.hostname() + '|' + (os.cpus()[0] && os.cpus()[0].model);
  cachedMachineId = crypto.createHash('sha256').update(guid).digest('hex').slice(0, 32);
  return cachedMachineId;
}

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(cacheFile(), 'utf8'));
  } catch (_) {
    return null;
  }
}
function writeCache(obj) {
  try {
    fs.writeFileSync(cacheFile(), JSON.stringify(obj, null, 2));
  } catch (_) {}
}

async function callFn(name, body) {
  const res = await fetch(FN + '/' + name, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + ANON_KEY,
      apikey: ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

function daysLeft(expiresAt) {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000));
}

// Construit l'état renvoyé au renderer
function stateFrom(cache, online) {
  const expiresAt = cache && cache.expiresAt ? cache.expiresAt : null;
  const dl = daysLeft(expiresAt);
  const active = cache && cache.status === 'active' && dl > 0;
  return {
    pro: !!active,
    status: cache ? cache.status : 'none',
    expiresAt,
    daysLeft: dl,
    email: cache ? cache.email : null,
    keyMasked: cache && cache.key ? maskKey(cache.key) : null,
    online: online !== false,
    buyUrl: BUY_URL,
  };
}
function maskKey(k) {
  const parts = String(k).split('-');
  if (parts.length < 2) return '••••';
  return parts[0] + '-••••-••••-••••-' + parts[parts.length - 1];
}

// Retourne l'état courant (cache) + rafraîchit en ligne si une clé est enregistrée
async function getState() {
  const cache = readCache();
  if (!cache || !cache.key) return stateFrom(null, true);
  try {
    const mid = await machineId();
    const r = await callFn('license-status', { key: cache.key, machineId: mid });
    if (r && r.ok) {
      const nc = { key: cache.key, status: r.status, expiresAt: r.expiresAt, email: r.email };
      writeCache(nc);
      return stateFrom(nc, true);
    }
    if (r && (r.error === 'expired' || r.error === 'revoked' || r.error === 'used_elsewhere' || r.error === 'invalid')) {
      const nc = { key: cache.key, status: r.error === 'expired' ? 'expired' : 'invalid', expiresAt: r.expiresAt || null };
      writeCache(nc);
      return { ...stateFrom(nc, true), reason: r.error };
    }
    // Réponse inattendue : on garde le cache (tolérance)
    return stateFrom(cache, true);
  } catch (_) {
    // Hors ligne : on fait confiance au cache tant que non expiré (grâce)
    return stateFrom(cache, false);
  }
}

async function activate(key) {
  const mid = await machineId();
  let r;
  try {
    r = await callFn('license-activate', {
      key,
      machineId: mid,
      machineLabel: os.hostname(),
    });
  } catch (e) {
    return { ok: false, error: 'network', message: 'Connexion impossible. Vérifiez votre accès Internet.' };
  }
  if (r && r.ok) {
    writeCache({ key: String(key).trim().toUpperCase(), status: r.status, expiresAt: r.expiresAt, email: r.email });
    return { ok: true, state: stateFrom(readCache(), true) };
  }
  return { ok: false, error: r ? r.error : 'unknown' };
}

async function claimTrial() {
  const mid = await machineId();
  let r;
  try {
    r = await callFn('trial-claim', { machineId: mid, machineLabel: os.hostname() });
  } catch (e) {
    return { ok: false, error: 'network' };
  }
  if (r && r.ok) {
    writeCache({ key: r.key, status: 'active', expiresAt: r.expiresAt, email: null });
    return { ok: true, state: stateFrom(readCache(), true) };
  }
  return { ok: false, error: r ? r.error : 'unknown' };
}

function deactivate() {
  try {
    fs.unlinkSync(cacheFile());
  } catch (_) {}
  return stateFrom(null, true);
}

// Identifiants pour vérifier le statut Pro côté serveur (remise assistance).
async function proCredentials() {
  const cache = readCache();
  return { key: cache && cache.key ? cache.key : null, machineId: await machineId() };
}

module.exports = { getState, activate, claimTrial, deactivate, machineId, proCredentials, BUY_URL };
