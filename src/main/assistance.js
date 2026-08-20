'use strict';
// ============================================================================
// Assistance à distance — prise en main, chat en direct et notifications.
// RÉUTILISE exactement le tunnel éprouvé de « FIX72 Antivirus » : channel.ps1
// téléchargé depuis support.fix72.com, listener 127.0.0.1:8765, état écrit dans
// C:\ProgramData\Fix72\channel_status.json. Ce module est indépendant du domaine
// (antivirus / récupération de comptes) : seuls les libellés changent.
// Tout le réseau passe par le process principal (la CSP du renderer bloque les
// requêtes externes).
// ============================================================================
const { BrowserWindow } = require('electron');
const { runRaw } = require('./ps');
const fs = require('fs');
const os = require('os');
const path = require('path');

const APP_NAME    = 'FIX72 Récup Compte';
const PHONE       = '07 51 13 37 69';
const FIX72_DIR   = 'C:\\ProgramData\\Fix72';
const STATUS_FILE = FIX72_DIR + '\\channel_status.json';

function dbg(msg) {
  try {
    fs.mkdirSync(FIX72_DIR, { recursive: true });
    fs.appendFileSync(FIX72_DIR + '\\recup_debug.log', new Date().toISOString() + '  ' + msg + '\r\n');
  } catch (_) {}
}

// --- Prise en main immédiate (canal HEADLESS lancé DANS l'app) ---------------
async function launchChannel() {
  try { fs.unlinkSync(STATUS_FILE); } catch (_) {}
  dbg('launchChannel: runRaw download+start...');
  const out = await runRaw(
    `New-Item -ItemType Directory -Force -Path '${FIX72_DIR}' | Out-Null; ` +
    `Get-Process ngrok -EA SilentlyContinue | Stop-Process -Force -EA SilentlyContinue; ` +
    `try{ Get-NetTCPConnection -LocalPort 8765 -EA SilentlyContinue | Where-Object { $_.OwningProcess -ne $PID } | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -EA SilentlyContinue } }catch{}; ` +
    `$pf=Join-Path '${FIX72_DIR}' 'channel.pid'; if(Test-Path $pf){ $op=(Get-Content $pf -Raw).Trim(); if($op -and $op -ne "$PID"){ Stop-Process -Id $op -Force -EA SilentlyContinue } }; ` +
    `Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -like '*channel.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -EA SilentlyContinue }; ` +
    `Start-Sleep -Milliseconds 900; ` +
    `$f=Join-Path '${FIX72_DIR}' 'channel.ps1'; ` +
    `$ok=$false; for($i=0;$i -lt 3 -and -not $ok;$i++){ try{ Remove-Item $f -Force -EA SilentlyContinue; Invoke-RestMethod -Uri 'https://support.fix72.com/channel.ps1' -OutFile $f; $ok=$true }catch{ Start-Sleep -Milliseconds 700 } }; ` +
    `if(-not $ok){ throw 'download impossible (fichier verrouille)' }; ` +
    `Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',$f; ` +
    `'launched'`
  );
  dbg('launchChannel: runRaw retour=' + String(out).slice(0, 80));
}

function readChannelStatus() {
  try { return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8').replace(/^﻿/, '')); } catch (_) { return null; }
}

async function waitForChannelPort(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const s = readChannelStatus();
    if (s && s.state === 'active' && s.port) return String(s.port);
    if (s && s.state === 'error') return null;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}

async function startTakeover() {
  dbg('startTakeover: DEBUT');
  try { await launchChannel(); }
  catch (e) { dbg('startTakeover: launchChannel THROW -> ' + (e && e.message)); return { ok: false, error: `Lancement bloqué (antivirus/Windows). Patientez quelques secondes et réessayez, ou appelez Etienne au ${PHONE}.` }; }
  dbg('startTakeover: launchChannel OK');
  return { ok: true };
}

async function listenerAlive() {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch('http://127.0.0.1:8765/', {
      method: 'POST',
      headers: { 'X-Fix72-Token': '1504', 'Content-Type': 'text/plain' },
      body: '1',
      signal: ctrl.signal,
    });
    return !!(res && res.status);
  } catch (_) { return false; }
  finally { clearTimeout(to); }
}

// Ouverture pilotée depuis l'admin fix72 (« Ouvrir un canal » sur ce poste).
async function openChannelForAdmin(reason) {
  dbg('openChannelForAdmin: DEBUT');
  let port = null;
  for (let attempt = 1; attempt <= 3 && !port; attempt++) {
    dbg('openChannelForAdmin: essai ' + attempt);
    try { await launchChannel(); }
    catch (e) { dbg('openChannelForAdmin: launchChannel THROW (essai ' + attempt + ') -> ' + (e && e.message)); continue; }
    const p = await waitForChannelPort(90000);
    dbg('openChannelForAdmin: essai ' + attempt + ' port=' + p);
    if (!p) continue;
    let alive = false;
    for (let i = 0; i < 5 && !alive; i++) {
      alive = await listenerAlive();
      if (!alive) await new Promise((r) => setTimeout(r, 1500));
    }
    if (alive) { dbg('openChannelForAdmin: listener VIVANT (essai ' + attempt + ')'); port = p; break; }
    dbg('openChannelForAdmin: listener MUET (essai ' + attempt + ') -> closeSession + relance');
    try { await closeSession(); } catch (_) {}
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (!port) {
    notifyTelegram(`⚠️ <b>${APP_NAME}</b>\nOuverture (admin) : le canal n'a pas pu s'ouvrir (listener muet) sur <b>${tgEscape(os.hostname())}</b>. Réessaie.`);
    return { ok: false, error: "Le canal n'a pas pu s'ouvrir (listener muet)." };
  }
  try {
    await supa('remote_requests', {
      method: 'POST',
      prefer: 'return=minimal',
      body: { problem: String(reason || 'Ouverture demandée depuis l’admin').slice(0, 2000), tunnel: String(port) },
    });
  } catch (_) {}
  notifyTelegram(
    `🛠️ <b>Canal ouvert (depuis l'admin) — ${APP_NAME}</b>\n💻 <b>${tgEscape(os.hostname())}</b>\n🔌 Tunnel/port : <b>${tgEscape(port)}</b>\n\nTu peux prendre la main.`
  );
  return { ok: true, port };
}

// Ouvre le canal + enregistre la demande (problème + port) pour l'admin/autopilot.
// `problem` contient ici le contexte de récupération de compte (plateforme + récit).
async function startSelfHelp(problem) {
  dbg('startSelfHelp: DEBUT (problem len=' + String(problem || '').length + ')');
  try { await launchChannel(); }
  catch (e) { dbg('startSelfHelp: launchChannel THROW -> ' + (e && e.message)); return { ok: false, error: `Lancement bloqué (antivirus/Windows). Patientez quelques secondes et réessayez, ou appelez Etienne au ${PHONE}.` }; }
  dbg('startSelfHelp: launchChannel OK, attente du port...');
  const port = await waitForChannelPort(90000);
  dbg('startSelfHelp: port=' + port);
  if (!port) return { ok: false, error: "Le canal n'a pas pu s'ouvrir. Réessayez ou appelez Etienne." };
  try {
    await supa('remote_requests', {
      method: 'POST',
      prefer: 'return=minimal',
      body: { problem: String(problem || '').slice(0, 2000), tunnel: String(port) },
    });
  } catch (_) {
    return { ok: false, error: "Demande non enregistrée. Réessayez ou appelez Etienne.", port };
  }
  notifyTelegram(
    `🔓 <b>${APP_NAME} — session ouverte</b>\n💻 <b>${tgEscape(os.hostname())}</b>\n🔌 Tunnel : <b>${tgEscape(port)}</b>\n📝 ${tgEscape(String(problem || '').slice(0, 500))}\n\nPrends la main pour la récupération.`
  );
  return { ok: true, port };
}

async function closeSession() {
  await runRaw(
    `Get-Process ngrok -EA SilentlyContinue | Stop-Process -Force -EA SilentlyContinue; ` +
    `Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.ProcessId -ne $PID -and ($_.CommandLine -like '*channel.ps1*' -or $_.CommandLine -like '*fix72_support.ps1*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -EA SilentlyContinue }; ` +
    `foreach($pf in @('fix72_badge.pid','fix72_toast.pid')){ $p=Join-Path $env:TEMP $pf; if(Test-Path $p){ try{ Stop-Process -Id ([int]((Get-Content $p -Raw).Trim())) -Force -EA SilentlyContinue }catch{}; Remove-Item $p -Force -EA SilentlyContinue } }; ` +
    `Remove-Item (Join-Path $env:TEMP 'fix72_badge_state.txt') -Force -EA SilentlyContinue; ` +
    `Remove-Item '${STATUS_FILE}' -Force -EA SilentlyContinue`
  ).catch(() => {});
  return true;
}

function clearChannelStatus() {
  try { fs.unlinkSync(STATUS_FILE); } catch (_) {}
}

function channelInfo() {
  try {
    const s = readChannelStatus();
    if (s && s.state === 'active' && s.port) return { active: true, port: String(s.port) };
  } catch (_) {}
  return { active: false, port: null };
}

function sessionState() {
  let channelActive = false;
  try {
    const s = readChannelStatus();
    channelActive = !!(s && s.state === 'active');
  } catch (_) {}
  let badge = 'none';
  try {
    const c = fs.readFileSync(path.join(os.tmpdir(), 'fix72_badge_state.txt'), 'utf8').replace(/^﻿/, '').trim();
    badge = c === 'done' ? 'done' : 'working';
  } catch (_) { badge = 'none'; }
  return { channelActive, badge };
}

// --- Notification Telegram à Etienne ----------------------------------------
const TG_TOKEN = '8837615366:AAGEmPQaO1jRCC0J9tC5y-OuFXiv-G6StVg';
const TG_CHAT = '7121042851';

function tgEscape(s) {
  return String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

async function notifyTelegram(text) {
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
  } catch (_) {}
}

// --- Chat en direct via Supabase REST (mêmes tables que le site fix72) ------
const SUPA_URL = 'https://juqxtwqwzhtermlesoaj.supabase.co';
const SUPA_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1cXh0d3F3emh0ZXJtbGVzb2FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MjUxMTksImV4cCI6MjA5MzIwMTExOX0.gQWLqJTO4WpOBAIZbui5U81XW6DSdLWzS81u-JF3WsQ';

async function supa(p, { method = 'GET', body, prefer } = {}) {
  const headers = { apikey: SUPA_ANON, Authorization: 'Bearer ' + SUPA_ANON, 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(SUPA_URL + '/rest/v1/' + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error((data && data.message) || ('HTTP ' + res.status));
  return data;
}

async function getMessages(sessionId) {
  return await supa(`chat_messages?session_id=eq.${sessionId}&order=created_at.asc&select=*`);
}

async function chatStart(name, firstMessage, context) {
  const rows = await supa('chat_sessions', { method: 'POST', prefer: 'return=representation', body: { customer_name: name } });
  const session = Array.isArray(rows) ? rows[0] : rows;
  await supa('chat_messages', { method: 'POST', body: { session_id: session.id, sender: 'customer', content: firstMessage } });
  notifyTelegram(
    `💬 <b>Chat ${APP_NAME}</b>\n👤 <b>${tgEscape(name)}</b>\n📝 ${tgEscape(firstMessage)}\n\n🔗 Répondre : https://fix72.com/chat-admin#${session.id}`
  );
  const messages = await getMessages(session.id);
  return { session, messages };
}

async function chatSend(sessionId, content) {
  await supa('chat_messages', { method: 'POST', body: { session_id: sessionId, sender: 'customer', content } });
  notifyTelegram(`💬 <b>${APP_NAME} — nouveau message</b>\n📝 ${tgEscape(content)}\n\n🔗 https://fix72.com/chat-admin#${sessionId}`);
  return await getMessages(sessionId);
}

async function chatPoll(sessionId) {
  const sessions = await supa(`chat_sessions?id=eq.${sessionId}&select=*`);
  const session = Array.isArray(sessions) && sessions.length ? sessions[0] : null;
  if (!session) return { session: null, messages: [] };
  const messages = await getMessages(sessionId);
  return { session, messages };
}

module.exports = {
  startTakeover, startSelfHelp, openChannelForAdmin, closeSession, sessionState,
  channelInfo, listenerAlive, clearChannelStatus, notifyTelegram, tgEscape,
  chatStart, chatSend, chatPoll,
};
