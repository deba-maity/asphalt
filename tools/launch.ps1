param([switch]$Editor,[string]$GodotPath)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'common.ps1')
$exe=Resolve-Godot $GodotPath
$launchArgs = @('--path', (Join-Path $repo 'game'))
if ($Editor) { $launchArgs += '--editor' }
& $exe @launchArgs
if ($LASTEXITCODE -ne 0) { throw "Godot exited with $LASTEXITCODE" }
