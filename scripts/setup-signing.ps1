# ============================================================================
# Installe et configure l'outillage Azure Trusted Signing pour Fix72 Antivirus.
#
# À LANCER UNE FOIS la validation d'identité Azure passée à « Terminé » ET le
# profil de certificat créé sur le portail (son nom va dans metadata.json).
#
# Ce script :
#   1. installe .NET SDK + Azure CLI (via winget) si absents ;
#   2. télécharge le paquet nuget Microsoft.Trusted.Signing.Client et en extrait
#      Azure.CodeSigning.Dlib.dll ;
#   3. lance « az login » (interactif) ;
#   4. affiche les variables d'environnement à définir avant « npm run publish ».
#
# Usage :  powershell -ExecutionPolicy Bypass -File scripts\setup-signing.ps1
# ============================================================================
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$toolsDir = Join-Path $root 'build\trusted-signing'
New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null

function Have($name) { [bool](Get-Command $name -ErrorAction SilentlyContinue) }

# 1) .NET SDK + Azure CLI ----------------------------------------------------
if (-not (Have 'dotnet')) {
  Write-Host '→ Installation de .NET SDK...' -ForegroundColor Cyan
  winget install --id Microsoft.DotNet.SDK.8 -e --accept-source-agreements --accept-package-agreements
}
if (-not (Have 'az')) {
  Write-Host '→ Installation de Azure CLI...' -ForegroundColor Cyan
  winget install --id Microsoft.AzureCLI -e --accept-source-agreements --accept-package-agreements
}

# 2) dlib Trusted Signing (via nuget) ----------------------------------------
Write-Host '→ Récupération de Azure.CodeSigning.Dlib.dll...' -ForegroundColor Cyan
$pkgDir = Join-Path $env:TEMP 'fix72-trusted-signing'
New-Item -ItemType Directory -Force -Path $pkgDir | Out-Null
$nupkg = Join-Path $pkgDir 'client.nupkg'
Invoke-WebRequest -Uri 'https://www.nuget.org/api/v2/package/Microsoft.Trusted.Signing.Client' -OutFile $nupkg
$extract = Join-Path $pkgDir 'extract'
if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
Expand-Archive -Path $nupkg -DestinationPath $extract -Force
$dll = Get-ChildItem $extract -Recurse -Filter 'Azure.CodeSigning.Dlib.dll' |
  Where-Object { $_.FullName -match 'x64' } | Select-Object -First 1
if (-not $dll) { throw 'Azure.CodeSigning.Dlib.dll introuvable dans le paquet nuget.' }
$destDll = Join-Path $toolsDir 'Azure.CodeSigning.Dlib.dll'
# On copie tout le dossier bin\x64 (la dll a des dépendances)
Copy-Item (Join-Path $dll.Directory.FullName '*') $toolsDir -Recurse -Force
Write-Host "   dlib -> $destDll" -ForegroundColor Green

# 3) Connexion Azure ---------------------------------------------------------
Write-Host '→ az login (une fenêtre de connexion va s''ouvrir)...' -ForegroundColor Cyan
az login | Out-Null
az account set --subscription '5289160f-6512-4008-8fc3-e4186a1ed0cd'

# 4) Rappel des variables ----------------------------------------------------
Write-Host ''
Write-Host '=========================================================' -ForegroundColor Yellow
Write-Host ' Avant « npm run publish », dans le MÊME terminal :' -ForegroundColor Yellow
Write-Host "   `$env:FIX72_SIGN = '1'" -ForegroundColor White
Write-Host "   `$env:TRUSTED_SIGNING_DLIB = '$destDll'" -ForegroundColor White
Write-Host ''
Write-Host ' ⚠️ Renseignez CertificateProfileName dans :' -ForegroundColor Yellow
Write-Host "   $toolsDir\metadata.json" -ForegroundColor White
Write-Host '=========================================================' -ForegroundColor Yellow
