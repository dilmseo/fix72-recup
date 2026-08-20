# FIX72 Récup Compte

Application Windows (Electron) d'assistance à la **récupération de comptes en ligne piratés ou perdus** (Facebook, Google/Gmail, Instagram, Outlook/Microsoft).

Construite sur le **même modèle que FIX72 Antivirus** : même design, même tunnel de prise en main à distance (`channel.ps1` via `support.fix72.com`, listener `127.0.0.1:8765`), présence « en ligne » dans l'admin fix72, notifications Telegram, chat en direct, auto-update GitHub.

## Ce que fait l'app
1. **Guides gratuits** pas-à-pas (FB, Google, Instagram, Microsoft) avec boutons ouvrant les vraies pages officielles de récupération.
2. **Forfait unique 15 €** → paiement Stripe intégré → ouverture d'un canal d'assistance chiffré → un technicien FIX72 prend la main et déroule la récupération avec le client. **Sans garantie de résultat.**
3. **Chat** + rappel téléphone.

## ⚠️ 2 choses à configurer avant la vente

### 1. Le lien de paiement Stripe 15 € (obligatoire)
Le paiement passe par un **Stripe Payment Link** (aucun backend à déployer).
- Dans le dashboard Stripe → **Payment Links** → créer un lien produit **« Récupération de compte — 15 € »**.
- Dans les options du lien : **After payment → Redirect customers to your website →** `https://fix72.com/paiement/succes`
  (c'est cette redirection qui permet à l'app de détecter le paiement réussi et d'ouvrir le tunnel).
- Coller l'URL du lien (`https://buy.stripe.com/....`) dans **`src/main/recovery.js`** → constante `PAYMENT_LINK`.
  - Alternative sans recompiler : créer `%APPDATA%\fix72-recup\config.json` = `{ "paymentLink": "https://buy.stripe.com/...." }`.

Tant que le lien n'est pas configuré, le bouton « Payer » affiche un message invitant à appeler le 07 51 13 37 69 (tu ouvres alors la session à la main depuis l'admin).

### 2. Le dépôt GitHub pour l'auto-update (optionnel au début)
`package.json` → `build.publish` pointe vers `dilmseo/fix72-recup`. Crée ce dépôt public quand tu veux activer les mises à jour automatiques. Sinon l'app fonctionne, elle ne fait juste pas de MAJ.

## Développer / tester
```
npm start            # lance l'app en dev
```

## Construire l'installeur
```
npm run dist         # → dist\FIX72-Recup-Compte-Setup.exe
```
NSIS non signé pour l'instant (comme l'antivirus au départ). SmartScreen affichera un avertissement tant que l'exe n'est pas signé.

## Réutilisé tel quel depuis FIX72 Antivirus
`ps.js`, `tunnels.js`, `presence.js`, `commands.js`, `owner.js`, `notify.js`, `toastwin*.js`, `license.js` (pour l'ID machine stable), `styles.css`.

## Notes
- L'app tourne en **admin** (nécessaire au tunnel : kill des process élevés, exclusions Defender de ngrok).
- Présence & « Ouvrir un canal » utilisent le **même backend ordi-facile** que l'antivirus → les postes Récup apparaissent dans le même admin fix72.
- Telegram : mêmes token/chat que l'antivirus, messages préfixés « FIX72 Récup Compte » pour distinguer le contexte.
