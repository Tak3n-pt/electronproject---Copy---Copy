; Custom NSIS script for CoreLink Desktop installer

!macro customHeader
  !system "echo Adding custom header"
!macroend

!macro preInit
  SetRegView 64
  WriteRegStr HKLM "Software\CoreLink" "InstallPath" "$INSTDIR"
!macroend

!macro customInit
  ; Check if another instance is running
  System::Call 'kernel32::CreateMutex(i 0, i 0, t "CoreLinkDesktopMutex") ?e'
  Pop $R0
  StrCmp $R0 0 +3
    MessageBox MB_OK|MB_ICONEXCLAMATION "CoreLink Desktop is already running. Please close it before continuing."
    Abort
!macroend

!macro customInstall
  ; Create desktop shortcut with custom icon
  CreateShortCut "$DESKTOP\CoreLink Desktop.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
  
  ; Create Start Menu shortcuts
  CreateDirectory "$SMPROGRAMS\CoreLink"
  CreateShortCut "$SMPROGRAMS\CoreLink\CoreLink Desktop.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  CreateShortCut "$SMPROGRAMS\CoreLink\Uninstall CoreLink.lnk" "$INSTDIR\Uninstall ${PRODUCT_FILENAME}.exe"
  
  ; Register file association
  WriteRegStr HKCR ".corelink" "" "CoreLink.DataFile"
  WriteRegStr HKCR "CoreLink.DataFile" "" "CoreLink Data File"
  WriteRegStr HKCR "CoreLink.DataFile\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCR "CoreLink.DataFile\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  
  ; Add to Windows Firewall exceptions
  nsExec::Exec 'netsh advfirewall firewall add rule name="CoreLink Desktop" dir=in action=allow program="$INSTDIR\${APP_EXECUTABLE_FILENAME}" enable=yes'
  
  ; Write additional registry entries
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayName" "CoreLink Desktop"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "Publisher" "CoreLink Software"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "DisplayIcon" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}" "UninstallString" "$INSTDIR\Uninstall ${PRODUCT_FILENAME}.exe"
!macroend

!macro customUnInstall
  ; Remove desktop shortcut
  Delete "$DESKTOP\CoreLink Desktop.lnk"
  
  ; Remove Start Menu shortcuts
  Delete "$SMPROGRAMS\CoreLink\CoreLink Desktop.lnk"
  Delete "$SMPROGRAMS\CoreLink\Uninstall CoreLink.lnk"
  RMDir "$SMPROGRAMS\CoreLink"
  
  ; Remove file association
  DeleteRegKey HKCR ".corelink"
  DeleteRegKey HKCR "CoreLink.DataFile"
  
  ; Remove from Windows Firewall
  nsExec::Exec 'netsh advfirewall firewall delete rule name="CoreLink Desktop"'
  
  ; Clean registry
  DeleteRegKey HKLM "Software\CoreLink"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}"
  
  ; Ask if user wants to delete app data
  MessageBox MB_YESNO "Do you want to delete all CoreLink data and settings?" IDNO +2
    RMDir /r "$APPDATA\CoreLink"
!macroend