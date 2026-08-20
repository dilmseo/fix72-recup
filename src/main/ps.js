'use strict';
const { execFile, spawn } = require('child_process');

// Chemin PowerShell (Windows PowerShell 5.1, présent partout sur Win10/11)
const PS = process.env.SystemRoot
  ? `${process.env.SystemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`
  : 'powershell.exe';

// Pas de "-ExecutionPolicy Bypass" : inutile pour les commandes -Command inline
// (la politique d'exécution ne concerne que les fichiers .ps1), et ce motif
// déclenche l'heuristique Defender PowExcEnv qui bloquait des appels de l'app.
const BASE_ARGS = ['-NoProfile', '-NonInteractive'];

// Prélude qui force l'UTF-8 en sortie (piège classique : BOM / accents cassés)
const PRELUDE = '$ErrorActionPreference="Stop";[Console]::OutputEncoding=[Text.Encoding]::UTF8;$OutputEncoding=[Text.Encoding]::UTF8;';

/**
 * Exécute une commande PowerShell et renvoie la sortie texte brute.
 */
function runRaw(command, { timeout = 0, _tries = 0 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      PS,
      [...BASE_ARGS, '-Command', PRELUDE + command],
      { maxBuffer: 64 * 1024 * 1024, timeout, windowsHide: true, encoding: 'utf8' },
      (err, stdout, stderr) => {
        if (err) {
          // "spawn EPERM/EBUSY/ETXTBSY" : Windows/antivirus verrouille brièvement
          // powershell.exe pendant son analyse → le lancement échoue. C'est quasi
          // toujours transitoire : on réessaie quelques fois avant d'abandonner.
          if (['EPERM', 'EBUSY', 'ETXTBSY', 'EAGAIN'].includes(err.code) && _tries < 4) {
            return setTimeout(
              () => runRaw(command, { timeout, _tries: _tries + 1 }).then(resolve, reject),
              500 * (_tries + 1)
            );
          }
          err.stderr = stderr;
          err.stdout = stdout;
          return reject(err);
        }
        resolve((stdout || '').trim());
      }
    );
  });
}

/**
 * Exécute une commande et parse le résultat JSON (ajoute ConvertTo-Json).
 * @param {string} expr - expression PowerShell qui produit l'objet
 */
async function runJson(expr, { depth = 6, timeout = 0 } = {}) {
  const cmd = `(${expr}) | ConvertTo-Json -Depth ${depth} -Compress`;
  const out = await runRaw(cmd, { timeout });
  if (!out) return null;
  try {
    return JSON.parse(out);
  } catch (e) {
    // Certaines commandes renvoient du texte non-JSON en cas d'échec
    throw new Error('Sortie non-JSON: ' + out.slice(0, 500));
  }
}

/**
 * Lance un processus (PowerShell ou exe) en streaming : chaque ligne stdout/stderr
 * est renvoyée via onData. Résout à la fin avec le code de sortie.
 */
function stream(file, args, onData, { env, _tries = 0 } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(file, args, { windowsHide: true, env: env || process.env });
    } catch (e) {
      if (['EPERM', 'EBUSY', 'ETXTBSY', 'EAGAIN'].includes(e.code) && _tries < 4) {
        return setTimeout(() => stream(file, args, onData, { env, _tries: _tries + 1 }).then(resolve, reject), 500 * (_tries + 1));
      }
      return reject(e);
    }
    let buf = '';
    const handle = (chunk) => {
      buf += chunk.toString('utf8');
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).replace(/\r$/, '');
        buf = buf.slice(idx + 1);
        if (line.length) onData(line);
      }
    };
    child.stdout.on('data', handle);
    child.stderr.on('data', handle);
    child.on('error', (e) => {
      if (['EPERM', 'EBUSY', 'ETXTBSY', 'EAGAIN'].includes(e.code) && _tries < 4) {
        return setTimeout(() => stream(file, args, onData, { env, _tries: _tries + 1 }).then(resolve, reject), 500 * (_tries + 1));
      }
      reject(e);
    });
    child.on('close', (code) => {
      if (buf.trim().length) onData(buf.trim());
      resolve(code);
    });
  });
}

function psStream(command, onData) {
  return stream(PS, [...BASE_ARGS, '-Command', PRELUDE + command], onData);
}

module.exports = { PS, runRaw, runJson, stream, psStream };
