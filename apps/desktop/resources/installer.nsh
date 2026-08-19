!include "LogicLib.nsh"

!ifndef BUILD_UNINSTALLER
  Var DshPreviousInstall
!endif

!macro customInit
  ReadRegStr $DshPreviousInstall HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${If} $DshPreviousInstall == ""
    ReadRegStr $DshPreviousInstall HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${EndIf}
  ${If} $DshPreviousInstall == ""
    ReadEnvStr $0 SystemDrive
    StrCpy $0 "$0\"
  ${Else}
    StrCpy $0 $DshPreviousInstall 3
  ${EndIf}
  StrCpy $INSTDIR "$0DeepSeek Harness\App"
!macroend

!macro customPageAfterChangeDir
  Page custom DshFixInstallDirectory
!macroend

!ifndef BUILD_UNINSTALLER
  Function DshFixInstallDirectory
    StrCpy $0 $INSTDIR 1 1
    ${If} $0 == ":"
      StrCpy $0 $INSTDIR 3
    ${Else}
      ReadEnvStr $0 SystemDrive
      StrCpy $0 "$0\"
    ${EndIf}
    StrCpy $INSTDIR "$0DeepSeek Harness\App"
    Abort
  FunctionEnd
!endif

!macro customInstall
  CreateDirectory "$INSTDIR\..\Data\Harness"
  CreateDirectory "$INSTDIR\..\Data\Desktop"
  nsExec::ExecToStack '"$SYSDIR\icacls.exe" "$INSTDIR\..\Data" /grant *S-1-5-32-545:(OI)(CI)M /T /C'
  Pop $0
  Pop $1
  ${If} $0 != 0
    Abort "无法设置 DeepSeek Harness 数据目录权限：$1"
  ${EndIf}
!macroend

!macro customUnInit
  ${IfNot} ${isUpdated}
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "确定要卸载 DeepSeek Harness 吗？" IDYES +2
    Quit
    MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 "卸载将永久删除聊天记录、配置、插件以及 DeepSeek 官网登录状态。此操作无法撤销，是否继续？" IDYES +2
    Quit
  ${EndIf}
!macroend

!macro customUnInstall
  ${IfNot} ${isUpdated}
    GetFullPathName $0 "$INSTDIR\.."
    RMDir /r "$0\Data"
  ${EndIf}
!macroend
