'use strict';
// ============================================================================
// Propriétaire du poste : nom + prénom saisis à la 1re ouverture de l'app.
// Stocké localement (userData\owner.json, persiste à travers les mises à jour)
// et renvoyé avec chaque heartbeat pour s'afficher dans l'admin fix72.
// ============================================================================
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function file() { return path.join(app.getPath('userData'), 'owner.json'); }

function get() {
  try {
    const d = JSON.parse(fs.readFileSync(file(), 'utf8'));
    return {
      firstName: String(d.firstName || '').trim(),
      lastName: String(d.lastName || '').trim(),
    };
  } catch (_) { return { firstName: '', lastName: '' }; }
}

// « Prénom Nom » propre, ou '' si rien de saisi.
function fullName() {
  const { firstName, lastName } = get();
  return [firstName, lastName].filter(Boolean).join(' ').trim();
}

function set(firstName, lastName) {
  const clean = {
    firstName: String(firstName || '').trim().slice(0, 60),
    lastName: String(lastName || '').trim().slice(0, 60),
  };
  try {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.writeFileSync(file(), JSON.stringify(clean));
  } catch (_) { /* best effort */ }
  return clean;
}

module.exports = { get, set, fullName };
