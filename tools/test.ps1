param([switch]$Campaign, [switch]$RealTime)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$pin = Get-Content -LiteralPath (Join-Path $repo 'engine-version.json') -Raw | ConvertFrom-Json
$exe = Join-Path $PSScriptRoot "engine\Godot_v$($pin.version)-stable_win64_console.exe"
New-Item -ItemType Directory -Path (Join-Path $PSScriptRoot 'logs') -Force | Out-Null
& $exe --headless --path (Join-Path $repo 'game') --editor --import --quit
if ($LASTEXITCODE -ne 0) { throw 'Import failed.' }
$baseArgs = @('--headless','--path',(Join-Path $repo 'game'))
if (-not $RealTime) { $baseArgs += @('--fixed-fps','60') }
foreach ($script in @('unit_tests','campaign_logic','ui_layout')) {
    & $exe @baseArgs --script "res://tests/$script.gd" 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot "logs\$script.log")
    if ($LASTEXITCODE -ne 0) { throw "$script checks failed." }
}
foreach ($mode in @('--validate-systems','--test-transitions')) {
    $label = $mode.TrimStart('-')
    & $exe @baseArgs -- $mode 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot "logs\$label.log")
    if ($LASTEXITCODE -ne 0) { throw "$label checks failed." }
}
if ($Campaign) {
    foreach ($mode in @('--campaign-play','--campaign-continue')) {
        $label = $mode.TrimStart('-')
        & $exe @baseArgs -- $mode 2>&1 | Tee-Object -FilePath (Join-Path $PSScriptRoot "logs\$label.log")
        if ($LASTEXITCODE -ne 0) { throw "$label checks failed." }
    }
}
Write-Output 'Headless checks finished. No game window or desktop input capture was used.'
