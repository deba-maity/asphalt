param([switch]$Templates)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$pin = Get-Content -LiteralPath (Join-Path $repo 'engine-version.json') -Raw | ConvertFrom-Json
$engineDir = Join-Path $PSScriptRoot 'engine'
$engineExe = Join-Path $engineDir "Godot_v$($pin.version)-stable_win64_console.exe"
if (-not (Test-Path -LiteralPath $engineExe)) {
    $archive = Join-Path $PSScriptRoot 'godot.zip'
    $url = "https://github.com/godotengine/godot-builds/releases/download/$($pin.version)-stable/Godot_v$($pin.version)-stable_win64.exe.zip"
    Invoke-WebRequest -Uri $url -OutFile $archive
    $digest = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($digest -ne $pin.windows_zip_sha256) { throw 'Engine archive checksum mismatch.' }
    Expand-Archive -LiteralPath $archive -DestinationPath $engineDir -Force
}
$actual = & $engineExe --version
if ($actual -notlike "$($pin.version).stable.*") { throw "Wrong engine version: $actual" }
Write-Output "Using $actual"
if ($Templates) {
    & python (Join-Path $PSScriptRoot 'fetch_windows_templates.py')
    if ($LASTEXITCODE -ne 0) { throw 'Template fetch failed.' }
}
& $engineExe --headless --path (Join-Path $repo 'game') --editor --import --quit
if ($LASTEXITCODE -ne 0) { throw 'Godot import failed.' }
