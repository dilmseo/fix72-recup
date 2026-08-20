'use strict';
// ============================================================================
// Hook de signature electron-builder → Azure Trusted Signing.
//
// SÉCURITÉ « build ne casse pas » : la signature ne s'exécute QUE si la variable
// d'environnement FIX72_SIGN vaut "1". Tant que la validation d'identité Azure
// n'est pas terminée (et que le profil de certificat n'existe pas), on laisse
// FIX72_SIGN vide → l'app se construit non signée, exactement comme aujourd'hui.
//
// Pré-requis pour signer (voir scripts/setup-signing.ps1) :
//   - Windows SDK (signtool.exe)                     ✅ déjà présent
//   - Azure.CodeSigning.Dlib.dll (nuget)  → env TRUSTED_SIGNING_DLIB
//   - build/trusted-signing/metadata.json (CertificateProfileName renseigné)
//   - Authentification Azure (az login, ou variables AZURE_* d'un service principal)
// ============================================================================
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function sign(configuration) {
  if (process.env.FIX72_SIGN !== '1') {
    console.log('[sign] FIX72_SIGN != 1 → signature ignorée (build non signé).');
    return;
  }

  const file = configuration.path;

  // signtool.exe : env SIGNTOOL sinon on prend la version SDK trouvée sur ce PC.
  const signtool =
    process.env.SIGNTOOL ||
    'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.26100.0\\x64\\signtool.exe';
  if (!fs.existsSync(signtool)) {
    throw new Error('[sign] signtool.exe introuvable : ' + signtool + ' (définir $env:SIGNTOOL).');
  }

  const dlib = process.env.TRUSTED_SIGNING_DLIB; // chemin Azure.CodeSigning.Dlib.dll
  if (!dlib || !fs.existsSync(dlib)) {
    throw new Error(
      '[sign] Azure.CodeSigning.Dlib.dll introuvable. Lancez scripts/setup-signing.ps1 ' +
        'puis définissez $env:TRUSTED_SIGNING_DLIB.'
    );
  }

  const metadata = path.join(__dirname, 'trusted-signing', 'metadata.json');
  const meta = JSON.parse(fs.readFileSync(metadata, 'utf8'));
  if (!meta.CertificateProfileName || /REMPLACER/i.test(meta.CertificateProfileName)) {
    throw new Error(
      '[sign] CertificateProfileName non renseigné dans build/trusted-signing/metadata.json ' +
        '(à créer sur le portail Azure une fois la validation d\'identité terminée).'
    );
  }

  const args = [
    'sign',
    '/v',
    '/fd', 'SHA256',
    '/tr', 'http://timestamp.acs.microsoft.com',
    '/td', 'SHA256',
    '/dlib', dlib,
    '/dmdf', metadata,
    file,
  ];
  console.log('[sign] ' + signtool + ' ' + args.join(' '));
  execFileSync(signtool, args, { stdio: 'inherit' });
};
