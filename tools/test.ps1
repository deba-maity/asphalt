param([switch]$Rendered)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$pin = Get-Content -LiteralPath (Join-Path $repo 'engine-version.json') -Raw | ConvertFrom-Json
$exe = Join-Path $PSScriptRoot "engine\Godot_v$($pin.version)-stable_win64_console.exe"
New-Item -ItemType Directory -Path (Join-Path $PSScriptRoot 'logs') -Force | Out-Null
& $exe --headless --path (Join-Path $repo 'game') --editor --import --quit
if ($LASTEXITCODE -ne 0) { throw 'Import failed.' }
& $exe --headless --path (Join-Path $repo 'game') --script res://tests/unit_tests.gd 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'logs\unit.log')
if ($LASTEXITCODE -ne 0) { throw 'Logic checks failed.' }
if ($Rendered) {
    foreach ($mode in @('systems','play','continue')) {
        & $exe --path (Join-Path $repo 'game') -- "--validate-$mode" 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot "logs\$mode.log")
        if ($LASTEXITCODE -ne 0) { throw "Rendered $mode checks failed." }
    }
    & $exe --path (Join-Path $repo 'game') --script res://tests/capture_ui.gd 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot 'logs\ui.log')
    if ($LASTEXITCODE -ne 0) { throw '720p menu layout checks failed.' }
}
