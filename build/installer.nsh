; Chronell — NSIS: Legacy „MailClient“/mailclient entfernen, Verknüpfungen auf Chronell.exe erzwingen

!macro customInstall
  ; Alte Binaries
  Delete "$INSTDIR\mailclient.exe"
  Delete "$INSTDIR\MailClient.exe"

  ; Veraltete Verknüpfungen (Desktop + Startmenü, alle früheren Namen)
  Delete "$DESKTOP\MailClient.lnk"
  Delete "$DESKTOP\mailclient.lnk"
  Delete "$DESKTOP\Chronell.lnk"
  Delete "$SMPROGRAMS\MailClient.lnk"
  Delete "$SMPROGRAMS\mailclient.lnk"
  Delete "$SMPROGRAMS\Chronell.lnk"
  !ifdef MENU_FILENAME
    Delete "$SMPROGRAMS\${MENU_FILENAME}\MailClient.lnk"
    Delete "$SMPROGRAMS\${MENU_FILENAME}\mailclient.lnk"
    Delete "$SMPROGRAMS\${MENU_FILENAME}\Chronell.lnk"
  !endif
  RMDir /r "$SMPROGRAMS\MailClient"
  RMDir /r "$SMPROGRAMS\mailclient"

  ; Korrekte Verknüpfungen (Icon = eingebettetes EXE-Icon)
  CreateShortCut "$DESKTOP\${SHORTCUT_NAME}.lnk" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
  ClearErrors
  WinShell::SetLnkAUMI "$DESKTOP\${SHORTCUT_NAME}.lnk" "${APP_ID}"

  !ifdef MENU_FILENAME
    CreateDirectory "$SMPROGRAMS\${MENU_FILENAME}"
    CreateShortCut "$SMPROGRAMS\${MENU_FILENAME}\${SHORTCUT_NAME}.lnk" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "$SMPROGRAMS\${MENU_FILENAME}\${SHORTCUT_NAME}.lnk" "${APP_ID}"
  !else
    CreateShortCut "$SMPROGRAMS\${SHORTCUT_NAME}.lnk" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "$SMPROGRAMS\${SHORTCUT_NAME}.lnk" "${APP_ID}"
  !endif

  WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" ShortcutName "${SHORTCUT_NAME}"
!macroend
