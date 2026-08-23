'use strict';
// ============================================================================
// Cœur métier « Récupération de compte ».
//  - Paiement du forfait unique 15 € via un Stripe Payment Link (aucun backend
//    à déployer : Etienne crée UN lien de paiement 15 € dans son dashboard
//    Stripe et colle son URL dans PAYMENT_LINK ci-dessous, ou dans le fichier
//    de config local). Le lien doit rediriger APRÈS paiement vers
//    https://fix72.com/paiement/succes (Payment Link → « After payment » →
//    « Redirect customers to your website »), c'est ainsi qu'on détecte le
//    succès.
//  - Une fois payé, on ouvre le tunnel d'assistance (assistance.startSelfHelp)
//    en y joignant le contexte (plateforme + récit), pour qu'Etienne prenne la
//    main et déroule la procédure de récupération.
//  - Anti-double-facturation : un paiement reste valable 7 jours sur ce poste
//    (si le tunnel tombe, on rouvre sans re-payer).
// ============================================================================
const { BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const assistance = require('./assistance');
const license = require('./license');

// Deux façons d'encaisser les 15 € — sur le MÊME compte Stripe FIX72. La 1re qui
// répond gagne :
//  A) Edge Function `recup-checkout` (déjà déployée sur le projet ordi-facile) :
//     crée une session Stripe côté serveur. S'active dès que le secret
//     STRIPE_SECRET_KEY est présent sur ce projet Supabase. Zéro action côté app.
//  B) Stripe Payment Link (repli) : coller l'URL dans PAYMENT_LINK ci-dessous ou
//     dans %APPDATA%\fix72-recup\config.json { "paymentLink": "https://buy.stripe.com/..." }.
// Le lien / la session doit rediriger après paiement vers
// https://fix72.com/paiement/succes (c'est ce qui déclenche l'ouverture du tunnel).
// Endpoint principal : fonction Netlify sur fix72.com (clé Stripe déjà en place,
// même compte que l'antivirus). Repli sur l'Edge Function Supabase puis le lien.
const NETLIFY_FN = 'https://fix72.com/.netlify/functions/create-recup-checkout';
const CHECKOUT_FN = 'https://juqxtwqwzhtermlesoaj.supabase.co/functions/v1/recup-checkout';
const CHECKOUT_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1cXh0d3F3emh0ZXJtbGVzb2FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MjUxMTksImV4cCI6MjA5MzIwMTExOX0.gQWLqJTO4WpOBAIZbui5U81XW6DSdLWzS81u-JF3WsQ';

// ⚠️ Repli : lien de paiement Stripe 15 € (laisser tel quel si on utilise (A)).
const PAYMENT_LINK = 'https://buy.stripe.com/REMPLACER_PAR_LE_LIEN_15E';

const PRICE_EUR = 15;
const PAYMENT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

function stateFile() { return path.join(app.getPath('userData'), 'recup-state.json'); }
function configFile() { return path.join(app.getPath('userData'), 'config.json'); }

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return null; }
}
function writeJson(file, obj) {
  try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(obj, null, 2)); } catch (_) {}
}

function paymentLink() {
  const cfg = readJson(configFile());
  const url = (cfg && cfg.paymentLink) || PAYMENT_LINK;
  return String(url || '').trim();
}

function hasValidPayment() {
  const st = readJson(stateFile());
  return !!(st && st.paidAt && (Date.now() - new Date(st.paidAt).getTime() < PAYMENT_TTL_MS));
}
function markPaid() { writeJson(stateFile(), { paidAt: new Date().toISOString() }); }

function linkConfigured() {
  return /^https:\/\/(buy\.stripe\.com|checkout\.stripe\.com)\//.test(paymentLink());
}
function priceInfo() {
  return { price: PRICE_EUR, paid: hasValidPayment(), linkConfigured: linkConfigured() };
}

// Récupère l'URL de paiement : (A) session Stripe créée par l'Edge Function, sinon
// (B) le Payment Link configuré. Renvoie null si aucun des deux n'est disponible.
async function resolveCheckoutUrl(ctx) {
  let machineId = null;
  try { machineId = await license.machineId(); } catch (_) {}

  // (A) Fonction Netlify fix72.com (clé Stripe déjà configurée) — endpoint principal
  try {
    const res = await fetch(NETLIFY_FN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { name: ctx.name || '', email: ctx.email || '', phone: ctx.phone || '' },
        platform: ctx.platform || '', story: ctx.story || '', machineId,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data && data.url) return data.url;
  } catch (_) { /* réseau : on tente les replis */ }

  // (B) Edge Function Supabase `recup-checkout` (repli, si STRIPE_SECRET_KEY y est posé)
  try {
    const res = await fetch(CHECKOUT_FN, {
      method: 'POST',
      headers: { apikey: CHECKOUT_ANON, Authorization: 'Bearer ' + CHECKOUT_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ctx.email || '', platform: ctx.platform || '', machineId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data && data.url) return data.url;
  } catch (_) { /* réseau : on tente le repli */ }

  // (C) Payment Link
  if (linkConfigured()) {
    let url = paymentLink();
    if (ctx.email) url += (url.includes('?') ? '&' : '?') + 'prefilled_email=' + encodeURIComponent(ctx.email);
    return url;
  }
  return null;
}

// Ouvre la fenêtre Stripe sur `url` et résout ok:true si le paiement aboutit.
function openPaymentWindow(parentWin, url) {
  if (!url) return Promise.resolve({ ok: false, error: 'no_link' });

  return new Promise((resolve) => {
    const cw = new BrowserWindow({
      width: 520, height: 780, parent: parentWin, modal: true, show: true,
      autoHideMenuBar: true, title: 'Paiement sécurisé — Stripe (15 €)', backgroundColor: '#ffffff',
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    let done = false;
    const onUrl = (navUrl) => {
      if (done) return;
      // Succès = redirection vers la page de succès fix72 (configurée sur le lien),
      // ou tout paramètre de complétion Stripe classique.
      if (/\/paiement\/succes/i.test(navUrl) || /[?&]redirect_status=succeeded/i.test(navUrl) || /checkout\.stripe\.com\/.+\/(complete|success)/i.test(navUrl)) {
        done = true;
        try { cw.destroy(); } catch (_) {}
        resolve({ ok: true });
      }
    };
    cw.webContents.on('will-redirect', (_e, u) => onUrl(u));
    cw.webContents.on('will-navigate', (_e, u) => onUrl(u));
    cw.webContents.on('did-navigate', (_e, u) => onUrl(u));
    cw.webContents.on('did-navigate-in-page', (_e, u) => onUrl(u));
    cw.on('closed', () => { if (!done) { done = true; resolve({ ok: false, error: 'cancelled' }); } });
    cw.loadURL(url);
  });
}

// Flux complet : (paiement si nécessaire) → ouverture du tunnel + envoi du
// contexte à Etienne. `context` = { platform, story, email, name }.
async function payAndHelp(context, parentWin) {
  const ctx = context || {};
  const summary = buildSummary(ctx);

  if (!hasValidPayment()) {
    const url = await resolveCheckoutUrl(ctx);
    const pay = await openPaymentWindow(parentWin, url);
    if (!pay.ok) {
      if (pay.error === 'no_link') {
        return { ok: false, error: "Le paiement n'est pas encore configuré. Appelez Etienne, il ouvre la session manuellement." };
      }
      return { ok: false, error: 'payment_cancelled' };
    }
    markPaid();
    assistance.notifyTelegram(
      `💶 <b>FIX72 Récup Compte — PAIEMENT 15 € reçu</b>\n👤 ${assistance.tgEscape(ctx.name || '—')}` +
      (ctx.email ? `\n✉️ ${assistance.tgEscape(ctx.email)}` : '') +
      `\n\nOuverture du tunnel en cours…`
    );
  }

  // Ouvre le tunnel + enregistre la demande (contexte de récup) pour l'admin.
  const r = await assistance.startSelfHelp(summary);
  return r && r.ok ? { ok: true, paid: true, port: r.port } : (r || { ok: false, error: 'tunnel' });
}

function platformLabel(p) {
  return ({ facebook: 'Facebook', google: 'Google / Gmail', instagram: 'Instagram', microsoft: 'Microsoft / Outlook', autre: 'Autre compte' }[p]) || 'Compte';
}

function buildSummary(ctx) {
  const lines = [
    `[RÉCUP COMPTE] ${platformLabel(ctx.platform)}`,
    ctx.name ? `Client : ${ctx.name}` : null,
    ctx.email ? `Email/identifiant : ${ctx.email}` : null,
    ctx.story ? `Situation : ${ctx.story}` : null,
  ].filter(Boolean);
  return lines.join('\n').slice(0, 2000);
}

module.exports = { payAndHelp, priceInfo, hasValidPayment, platformLabel, PRICE_EUR };
