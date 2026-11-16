param([string]$GodotPath,[string]$JavaDirectory=$env:JAVA_HOME,[string]$SdkDirectory=$env:ANDROID_HOME,[string]$TemplateDirectory,[switch]$CheckOnly,[switch]$InternalBuild)
. (Join-Path $PSScriptRoot 'common.ps1')
$exe=Resolve-Godot $GodotPath
if (-not $TemplateDirectory) { $TemplateDirectory=Join-Path $PSScriptRoot "export_templates\$($script:EnginePin.export_templates)" }
$template=Join-Path $TemplateDirectory 'android_release.apk'
$missing=[Collections.Generic.List[string]]::new()
if (-not $JavaDirectory -or -not (Test-Path -LiteralPath (Join-Path "$JavaDirectory" 'bin\java.exe'))) { $missing.Add('JDK 17: pass -JavaDirectory or set JAVA_HOME for this shell.') }
if (-not $SdkDirectory) { $missing.Add('Android SDK: pass -SdkDirectory or set ANDROID_HOME for this shell.') }
else {
    foreach ($relative in @('platform-tools\adb.exe','platforms\android-36\android.jar','build-tools\36.1.0\apksigner.bat','build-tools\36.1.0\zipalign.exe','build-tools\36.1.0\aapt.exe')) {
        if (-not (Test-Path -LiteralPath (Join-Path $SdkDirectory $relative))) { $missing.Add("SDK missing $relative. See docs\android.md.") }
    }
}
if (-not (Test-Path -LiteralPath $template)) { $missing.Add('Matching Android template: python tools\fetch_windows_templates.py --android') }
elseif ((Get-FileHash -LiteralPath $template -Algorithm SHA256).Hash.ToLowerInvariant() -ne $script:EnginePin.template_sha256.'android_release.apk') { $missing.Add('Android template SHA-256 mismatch; fetch the pinned standard template again.') }
if ($missing.Count) { $missing | Write-Output; if ($CheckOnly) { Write-Output 'Android unavailable; check-only did not export or install anything.'; return }; throw 'Android prerequisites incomplete.' }
$oldPreference=$ErrorActionPreference
$ErrorActionPreference='Continue'
try { $javaVersion=& (Join-Path $JavaDirectory 'bin\java.exe') -version 2>&1; $javaExit=$LASTEXITCODE } finally { $ErrorActionPreference=$oldPreference }
if ($javaExit -ne 0 -or ($javaVersion | Out-String) -notmatch 'version "17\.') { throw 'This preparation pins JDK 17. Pass its installation directory.' }
if ($CheckOnly) { Write-Output 'Toolchain prerequisites passed. Touch/device acceptance still NOT RUN; no APK built.'; return }
if (-not $InternalBuild) { throw 'Touch support is incomplete. Pass -InternalBuild for a signed internal keyboard/controller experiment, never a public mobile release.' }
foreach ($name in @('GODOT_ANDROID_KEYSTORE_RELEASE_PATH','GODOT_ANDROID_KEYSTORE_RELEASE_USER','GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD')) {
    if (-not [Environment]::GetEnvironmentVariable($name)) { throw "Set $name in this shell/CI secrets; do not put credentials in export_presets.cfg." }
}
if (-not (Test-Path -LiteralPath $env:GODOT_ANDROID_KEYSTORE_RELEASE_PATH)) { throw 'Release keystore file not found.' }
$isolated=Join-Path $PSScriptRoot 'cache\android-editor'
New-Item -ItemType Directory -Path $isolated -Force | Out-Null
foreach ($engineFile in (Get-ChildItem -LiteralPath (Split-Path -Parent $exe) -Filter '*.exe')) { Copy-Item -LiteralPath $engineFile.FullName -Destination $isolated -Force }
Set-Content -LiteralPath (Join-Path $isolated '_sc_') -Value ''
$isolatedExe=Join-Path $isolated (Split-Path -Leaf $exe)
$output=Join-Path $script:RepoRoot 'exports\android\AshenVow-internal.apk'
if (Test-Path -LiteralPath $output) { throw 'Internal APK already exists. Move it to an explicitly named archive before rebuilding.' }
New-Item -ItemType Directory -Path (Split-Path -Parent $output) -Force | Out-Null
$previousJava=$env:JAVA_HOME
try {
    $env:JAVA_HOME=$JavaDirectory
    & python (Join-Path $PSScriptRoot 'prepare_android.py') --java $JavaDirectory --sdk $SdkDirectory --template $template --editor-data (Join-Path $isolated 'editor_data')
    if ($LASTEXITCODE -ne 0) { throw 'Android preset preparation failed.' }
    try {
        Invoke-Godot $isolatedExe @('--headless','--path',(Join-Path $script:RepoRoot 'game'),'--editor','--import','--quit') (Join-Path $PSScriptRoot 'logs\android-import.log')
        Invoke-Godot $isolatedExe @('--headless','--path',(Join-Path $script:RepoRoot 'game'),'--export-release','Android Experimental',$output) (Join-Path $PSScriptRoot 'logs\android-export.log')
    } finally { & python (Join-Path $PSScriptRoot 'prepare_export.py') --restore }
    & (Join-Path $SdkDirectory 'build-tools\36.1.0\apksigner.bat') verify --verbose --print-certs $output
    if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed; do not distribute.' }
    & (Join-Path $SdkDirectory 'build-tools\36.1.0\aapt.exe') dump badging $output
    if ($LASTEXITCODE -ne 0) { throw 'APK manifest inspection failed.' }
    $permissions=& (Join-Path $SdkDirectory 'build-tools\36.1.0\aapt.exe') dump permissions $output
    if ($LASTEXITCODE -ne 0 -or ($permissions | Out-String) -match 'android.permission.(INTERNET|ACCESS_NETWORK_STATE|READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|CAMERA|RECORD_AUDIO)') { throw 'Unexpected permission or failed permission inspection; do not distribute.' }
    Get-FileHash -LiteralPath $output -Algorithm SHA256
    Write-Output 'SIGNED INTERNAL EXPERIMENT ONLY. Install/play/update/device acceptance is NOT RUN. No site download was enabled.'
} finally { $env:JAVA_HOME=$previousJava }
