param([switch]$Editor)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$pin = Get-Content -LiteralPath (Join-Path $repo 'engine-version.json') -Raw | ConvertFrom-Json
$exe = Join-Path $PSScriptRoot "engine\Godot_v$($pin.version)-stable_win64.exe"
if (-not (Test-Path -LiteralPath $exe)) {
    & (Join-Path $PSScriptRoot 'setup.ps1')
}
$launchArgs = @('--path', (Join-Path $repo 'game'))
if ($Editor) { $launchArgs += '--editor' }
& $exe @launchArgs
