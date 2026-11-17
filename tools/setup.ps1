param([switch]$Templates, [switch]$ReleaseTools, [string]$GodotPath)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')
if ($Templates) { Assert-BuildPython }
$repo = Split-Path -Parent $PSScriptRoot
$pin = Get-Content -LiteralPath (Join-Path $repo 'engine-version.json') -Raw | ConvertFrom-Json
$engineDir = Join-Path $PSScriptRoot 'engine'
$engineExe = Join-Path $engineDir "Godot_v$($pin.version)-stable_win64_console.exe"
if ($GodotPath) { $engineExe=Resolve-Godot $GodotPath }
elseif ($env:GODOT_EXE) { $engineExe=Resolve-Godot $env:GODOT_EXE }
if (-not (Test-Path -LiteralPath $engineExe)) {
    $archive = Join-Path $PSScriptRoot 'godot.zip'
    $url = "https://github.com/godotengine/godot-builds/releases/download/$($pin.version)-stable/Godot_v$($pin.version)-stable_win64.exe.zip"
    Invoke-WebRequest -Uri $url -OutFile $archive
    $digest = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($digest -ne $pin.windows_zip_sha256) { throw 'Engine archive checksum mismatch.' }
    Expand-Archive -LiteralPath $archive -DestinationPath $engineDir -Force
}
$engineExe=Resolve-Godot $engineExe
Write-Output "Using $engineExe"
if ($Templates) {
    & python (Join-Path $PSScriptRoot 'fetch_windows_templates.py')
    if ($LASTEXITCODE -ne 0) { throw 'Template fetch failed.' }
}
if ($ReleaseTools) {
    $tool = Join-Path $PSScriptRoot 'cache\rcedit-x64.exe'
    New-Item -ItemType Directory -Path (Split-Path -Parent $tool) -Force | Out-Null
    if (-not (Test-Path -LiteralPath $tool)) { Invoke-WebRequest -Uri $pin.rcedit.url -OutFile $tool }
    if ((Get-FileHash -LiteralPath $tool -Algorithm SHA256).Hash.ToLowerInvariant() -ne $pin.rcedit.sha256) { throw 'Pinned rcedit checksum mismatch.' }
}
Invoke-Godot $engineExe @('--headless','--path',(Join-Path $repo 'game'),'--editor','--import','--quit') (Join-Path $PSScriptRoot 'logs\setup-import.log')
