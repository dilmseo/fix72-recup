'use strict';
// Charge le fichier .env (sans dépendance externe) puis publie via electron-builder.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');

if (fs.existsSync(envPath)) {
  for (const raw of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = val;
  }
}

if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
  console.error('❌ GH_TOKEN introuvable. Ajoute-le dans le fichier .env à la racine du projet.');
  process.exit(1);
}

// Résout l'entrée JS d'electron-builder et l'exécute via Node (gère les espaces dans le chemin)
const ebPkg = require(path.join(root, 'node_modules', 'electron-builder', 'package.json'));
const binRel = typeof ebPkg.bin === 'string' ? ebPkg.bin : ebPkg.bin['electron-builder'];
const cliJs = path.join(root, 'node_modules', 'electron-builder', binRel);

console.log('🔑 Token chargé depuis .env — publication en cours…');
const r = spawnSync(process.execPath, [cliJs, '--win', '--publish', 'always'], { stdio: 'inherit', env: process.env });
process.exit(r.status == null ? 1 : r.status);
