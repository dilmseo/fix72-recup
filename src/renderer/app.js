'use strict';
const api = window.recup;
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// --- Icônes (SVG inline -> masque CSS) --------------------------------------
const ICONS = {
  home: 'M3 11l9-8 9 8M5 9.5V21h5v-6h4v6h5V9.5',
  grid: 'M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z',
  facebook: 'M15 3h-2.5A3.5 3.5 0 009 6.5V10H6v4h3v7h4v-7h3l.7-4H13V7a1 1 0 011-1h2z',
  google: 'M21 12.2c0 5-3.4 8.3-8.5 8.3A8.5 8.5 0 1112.5 3.5c2.3 0 4.2.85 5.7 2.2l-2.3 2.2A5 5 0 1017.4 13H12.5v-2.9H21z',
  instagram: 'M7 3h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4zM12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM17.3 6.7v.01',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  unlock: 'M7 10V7a5 5 0 019.6-2M5 10h12v10H5zM11 14v3',
  headset: 'M4 13v-1a8 8 0 0116 0v1M4 13h3v6H5.5A1.5 1.5 0 014 17.5zM20 13h-3v6h1.5a1.5 1.5 0 001.5-1.5zM17 19a4 3 0 01-4 2h-1',
  phone: 'M4 4h4l2 5-3 2a12 12 0 006 6l2-3 5 2v4a1 1 0 01-1 1A17 17 0 013 5a1 1 0 011-1z',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  refresh: 'M21 12a9 9 0 11-2.6-6.3M21 4v4h-4',
  info: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v5M12 7.6v.4',
  doc: 'M7 3h7l4 4v14H7zM14 3v4h4M9.5 12h5M9.5 16h5',
  alert: 'M12 3l10 18H2zM12 9v5M12 17v.5',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M20 6L9 17l-5-5',
  card: 'M2 6h20v12H2zM2 10h20M6 14h4',
  ext: 'M14 4h6v6M20 4l-9 9M18 13v6H5V6h6',
  key: 'M21 2l-2 2M11.4 11.6a5.5 5.5 0 11-7.8 7.8 5.5 5.5 0 017.8-7.8zM15.5 7.5l3 3L22 7l-3-3',
  shield: 'M12 3l7 3v5c0 4.5-3 8.3-7 9.5C8 19.3 5 15.5 5 11V6z',
};
function svgMask(d) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='${d}'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
function paintIcons(root) {
  (root || document).querySelectorAll('i[data-i]').forEach((el) => el.style.setProperty('--ic', svgMask(ICONS[el.dataset.i] || '')));
}
paintIcons(document);

// --- Splash -----------------------------------------------------------------
setTimeout(() => { const s = $('#splash'); if (s) { s.classList.add('hide'); setTimeout(() => s.remove(), 600); } }, 1100);

// --- Navigation -------------------------------------------------------------
function show(view) {
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
  $$('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.view === view));
  $('.content').scrollTop = 0;
  if (view === 'chat') setTimeout(() => $('#chat-text') && $('#chat-text').focus(), 60);
}
$$('.nav-item').forEach((n) => n.addEventListener('click', () => show(n.dataset.view)));
document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-goto]');
  if (g) { show(g.dataset.goto); }
});
if (api.onGoto) api.onGoto((v) => show(v));

// --- Contrôles fenêtre ------------------------------------------------------
$('#tb-min').addEventListener('click', () => api.winMinimize());
$('#tb-max').addEventListener('click', () => api.winMaximize());
$('#tb-close').addEventListener('click', () => api.winClose());

// --- Toasts ------------------------------------------------------------------
function toast(msg, type = 'info', ms = 4200) {
  const wrap = $('#toast-wrap');
  const t = document.createElement('div');
  t.className = 'toast';
  const accent = type === 'ok' ? '#33d98a' : type === 'err' ? '#f56368' : type === 'warn' ? '#f8bd57' : '#3dd7c8';
  t.style.setProperty('--toast-accent', accent);
  const icon = type === 'ok' ? 'check' : type === 'err' ? 'close' : type === 'warn' ? 'alert' : 'info';
  t.innerHTML = `<span class="toast-ic"><i data-i="${icon}"></i></span><span class="toast-msg">${msg}</span>`;
  wrap.appendChild(t);
  paintIcons(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.add('hide'); setTimeout(() => t.remove(), 260); }, ms);
}

// --- Guides -----------------------------------------------------------------
const GUIDES = {
  facebook: [
    { t: 'Ouvrez la page « Compte piraté » de Facebook', p: "C'est le point d'entrée officiel quand quelqu'un a pris le contrôle de votre compte.", a: [['Ouvrir facebook.com/hacked', 'https://www.facebook.com/hacked']] },
    { t: 'Identifiez votre compte', p: "Si vous n'arrivez plus à vous connecter, retrouvez votre compte avec votre e-mail, téléphone ou nom.", a: [['Retrouver mon compte', 'https://www.facebook.com/login/identify']] },
    { t: 'Réinitialisez le mot de passe', p: "Demandez un code par e-mail ou SMS. Si le pirate a changé l'e-mail, Facebook peut proposer votre ancienne adresse — utilisez-la.", a: [['Réinitialiser', 'https://www.facebook.com/login/identify']], tip: "Vérifiez vos e-mails : Facebook envoie une alerte quand l'adresse est changée, avec un lien « Sécuriser mon compte » / annuler le changement." },
    { t: "Si le pirate a changé l'e-mail", p: "Cherchez dans votre boîte mail un message de security@facebookmail.com « Votre adresse e-mail a été modifiée ». Le lien pour revenir en arrière y figure.", a: [] },
    { t: 'Sécurisez le compte récupéré', p: "Changez le mot de passe, déconnectez les appareils inconnus et activez la double authentification.", a: [['Sécurité et connexion', 'https://www.facebook.com/settings?tab=security']] },
  ],
  google: [
    { t: 'Lancez la récupération de compte Google', p: "L'assistant officiel vous pose des questions pour vérifier que le compte est bien le vôtre.", a: [['Ouvrir g.co/recover', 'https://accounts.google.com/signin/recovery']] },
    { t: 'Saisissez un ancien mot de passe', p: "Même très ancien : c'est l'un des signaux les plus forts pour Google.", a: [] },
    { t: "Utilisez l'appareil habituel", p: "Faites la démarche depuis un téléphone ou un ordinateur déjà connecté à ce compte, sur votre réseau habituel.", a: [], tip: "Si Google dit « impossible de vérifier », réessayez plus tard depuis le même appareil : le score de confiance évolue." },
    { t: 'Vérifiez e-mail et téléphone de secours', p: "Si vous y avez accès, récupérez le code envoyé sur l'adresse ou le numéro de secours.", a: [] },
    { t: 'Après récupération : verrouillez', p: "Faites le contrôle de sécurité, changez le mot de passe et retirez les appareils inconnus.", a: [['Contrôle de sécurité', 'https://myaccount.google.com/security-checkup']] },
  ],
  instagram: [
    { t: 'Signalez le piratage dans l\'app', p: "Sur l'écran de connexion : « Vous avez besoin d'aide ? » puis suivez « Mon compte a été piraté ».", a: [['Ouvrir instagram.com/hacked', 'https://www.instagram.com/hacked']] },
    { t: 'Demandez un lien de connexion', p: "Instagram peut envoyer un lien de récupération sur votre e-mail ou téléphone d'origine.", a: [['Récupérer l\'accès', 'https://www.instagram.com/accounts/login/']] },
    { t: 'Selfie vidéo de vérification', p: "Si demandé, filmez-vous en tournant la tête : c'est la preuve d'identité officielle d'Instagram.", a: [] },
  ],
  microsoft: [
    { t: 'Réinitialisez le mot de passe', p: "Point d'entrée officiel Microsoft pour un compte Outlook/Hotmail/Live inaccessible.", a: [['Réinitialiser', 'https://account.live.com/password/reset']] },
    { t: 'Formulaire de récupération', p: "Si la réinitialisation échoue, remplissez le formulaire de récupération : anciens mots de passe, contacts e-mail, objets de mails récents…", a: [['Formulaire de récupération', 'https://account.live.com/acsr']] },
    { t: 'Vérifiez les infos de sécurité', p: "Une fois l'accès repris, mettez à jour e-mail/téléphone de secours et activez la vérification en deux étapes.", a: [['Sécurité du compte', 'https://account.microsoft.com/security']] },
  ],
};
function renderGuide(id, steps) {
  const el = $('#guide-' + id);
  if (!el) return;
  el.innerHTML = steps.map((s, i) => {
    const acts = (s.a || []).map(([label, url]) => `<button class="btn" data-url="${url}"><i data-i="ext"></i> ${label}</button>`).join('');
    const tip = s.tip ? `<div class="step-tip"><b>Astuce :</b> ${s.tip}</div>` : '';
    return `<div class="step"><div class="step-n">${i + 1}</div><div class="step-body"><b>${s.t}</b><p>${s.p}</p>${acts ? `<div class="step-actions">${acts}</div>` : ''}${tip}</div></div>`;
  }).join('');
  paintIcons(el);
}
Object.entries(GUIDES).forEach(([id, steps]) => renderGuide(id, steps));
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-url]');
  if (b) { api.openExternal(b.dataset.url); toast('Ouverture dans votre navigateur…', 'info', 2200); }
});

// --- Accueil : nom + version ------------------------------------------------
(async () => {
  try {
    const v = await api.version();
    const value = (v && v.data) ? v.data : '';
    $('#app-ver').textContent = value || '—';
    $('#about-ver').textContent = value || '—';
  } catch (_) {}
  try {
    const o = await api.ownerGet();
    const owner = o && o.data ? o.data : null;
    const name = owner && (owner.firstName || '');
    if (name) $('#greet-name').textContent = ' ' + name;
  } catch (_) {}
  try {
    const a = await api.getAutoLaunch();
    if (a && a.data) $('#set-autolaunch').checked = true;
  } catch (_) {}
})();

$('#set-autolaunch').addEventListener('change', async (e) => {
  await api.setAutoLaunch(e.target.checked);
  toast(e.target.checked ? 'Lancement au démarrage activé.' : 'Lancement au démarrage désactivé.', 'ok');
});
$('#btn-check-update').addEventListener('click', async () => { await api.checkUpdate(); toast('Recherche de mise à jour…', 'info'); });

// --- Paiement + prise en main -----------------------------------------------
const btnPay = $('#btn-pay');
btnPay.addEventListener('click', async () => {
  const context = {
    name: $('#af-name').value.trim(),
    email: $('#af-email').value.trim(),
    platform: $('#af-platform').value,
    phone: $('#af-phone').value.trim(),
    story: $('#af-story').value.trim(),
  };
  if (context.phone && context.story) context.story = context.story + ' — Tel: ' + context.phone;
  else if (context.phone) context.story = 'Tel: ' + context.phone;

  const note = $('#assist-note');
  note.style.display = 'none';
  btnPay.disabled = true;
  btnPay.innerHTML = '<i data-i="card"></i> Paiement en cours…';
  paintIcons(btnPay);

  try {
    const res = await api.payAndHelp(context);
    const inner = res && res.ok ? res.data : null;
    if (inner && inner.ok) {
      showActiveSession('Paiement reçu. La prise en main démarre automatiquement — restez sur cet écran.');
      toast('Session ouverte ✅ La prise en main automatique démarre.', 'ok', 6000);
    } else {
      const err = (inner && inner.error) || (res && res.error) || 'inconnu';
      if (err === 'payment_cancelled') {
        note.className = 'ad-note warn'; note.style.display = 'block';
        note.textContent = 'Paiement annulé. Vous pouvez réessayer quand vous voulez, ou appeler le 07 51 13 37 69.';
      } else if (/paiement n'est pas encore configuré|no_link/.test(err)) {
        note.className = 'ad-note err'; note.style.display = 'block';
        note.textContent = "Le paiement en ligne n'est pas encore activé. Appelez le 07 51 13 37 69 : on ouvre la session pour vous.";
      } else {
        note.className = 'ad-note err'; note.style.display = 'block';
        note.textContent = 'Souci : ' + err + '. Réessayez ou appelez le 07 51 13 37 69.';
      }
    }
  } catch (e) {
    note.className = 'ad-note err'; note.style.display = 'block';
    note.textContent = 'Erreur : ' + (e && e.message ? e.message : e);
  } finally {
    btnPay.disabled = false;
    btnPay.innerHTML = '<i data-i="card"></i> Payer 15 € et démarrer';
    paintIcons(btnPay);
  }
});

function showActiveSession(sub) {
  $('#assist-idle').style.display = 'none';
  $('#assist-active').style.display = 'block';
  if (sub) $('#assist-active-sub').textContent = sub;
  show('assistance');
}
function showIdleSession() {
  $('#assist-active').style.display = 'none';
  $('#assist-idle').style.display = 'block';
}

$('#btn-close-session').addEventListener('click', async () => {
  await api.assistanceCloseSession();
  showIdleSession();
  toast('Session terminée. À bientôt !', 'ok');
});

// Détecte une session déjà active (tunnel ouvert) au démarrage + périodiquement.
async function refreshSessionState() {
  try {
    const r = await api.assistanceSessionState();
    const st = r && r.data ? r.data : null;
    if (st && st.channelActive) {
      if ($('#assist-active').style.display === 'none' || !$('#assist-active').style.display) showActiveSessionSilently();
    }
  } catch (_) {}
}
function showActiveSessionSilently() {
  $('#assist-idle').style.display = 'none';
  $('#assist-active').style.display = 'block';
}
refreshSessionState();
setInterval(refreshSessionState, 8000);

// Ouverture pilotée depuis l'admin (le technicien ouvre le canal) → bascule l'UI.
if (api.onRemoteOpenChannel) api.onRemoteOpenChannel(() => { showActiveSessionSilently(); toast('Prise en main automatique FIX72 en cours…', 'info', 6000); });
if (api.onRemoteCloseChannel) api.onRemoteCloseChannel(() => { showIdleSession(); });

// --- Chat -------------------------------------------------------------------
let chatSessionId = null;
let chatPollTimer = null;
function timeStr(iso) { try { const d = new Date(iso); return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0'); } catch (_) { return ''; } }
function renderMessages(messages) {
  const box = $('#chat-msgs');
  if (!messages || !messages.length) { box.innerHTML = '<div class="empty">Aucun message pour l\'instant. Dites-nous tout 👇</div>'; return; }
  box.innerHTML = messages.map((m) => {
    const mine = m.sender === 'customer';
    return `<div class="chat-msg ${mine ? 'from-me' : 'from-admin'}"><span class="chat-txt"></span><span class="chat-time">${timeStr(m.created_at)}</span></div>`;
  }).join('');
  // Injecte le texte via textContent (anti-XSS)
  Array.from(box.querySelectorAll('.chat-msg')).forEach((el, i) => { el.querySelector('.chat-txt').textContent = messages[i].content; });
  box.scrollTop = box.scrollHeight;
}
async function pollChat() {
  if (!chatSessionId) return;
  try { const r = await api.chatPoll(chatSessionId); const d = r && r.data ? r.data : r; if (d && d.messages) renderMessages(d.messages); } catch (_) {}
}
$('#chat-send').addEventListener('click', sendChat);
$('#chat-text').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });
async function sendChat() {
  const text = $('#chat-text').value.trim();
  if (!text) return;
  const name = ($('#chat-name').value.trim()) || 'Client';
  $('#chat-text').value = '';
  try {
    if (!chatSessionId) {
      const r = await api.chatStart(name, text, 'FIX72 Récup Compte (application)');
      const d = r && r.data ? r.data : r;
      if (d && d.session) { chatSessionId = d.session.id; renderMessages(d.messages); }
      if (!chatPollTimer) chatPollTimer = setInterval(pollChat, 5000);
    } else {
      const r = await api.chatSend(chatSessionId, text);
      const d = r && r.data ? r.data : r;
      if (d && d.messages) renderMessages(d.messages); else pollChat();
    }
  } catch (e) { toast("Message non envoyé. Vérifiez votre connexion.", 'err'); }
}
// Auto-grow du textarea du chat
$('#chat-text').addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(120, this.scrollHeight) + 'px'; });
