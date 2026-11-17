param([switch]$Campaign, [switch]$RealTime, [ValidateSet(30,60)][int]$SimulationHz=60, [string]$GodotPath)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$pin = Get-Content -LiteralPath (Join-Path $repo 'engine-version.json') -Raw | ConvertFrom-Json
. (Join-Path $PSScriptRoot 'common.ps1')
$exe = Resolve-Godot $GodotPath
New-Item -ItemType Directory -Path (Join-Path $PSScriptRoot 'logs') -Force | Out-Null
Invoke-Godot $exe @('--headless','--path',(Join-Path $repo 'game'),'--editor','--import','--quit') (Join-Path $PSScriptRoot 'logs\test-import.log')
$validationMutex = New-Object System.Threading.Mutex($false, 'Local\AshenVowValidation')
$ownsValidationLock = $false
try {
    try {
        $ownsValidationLock = $validationMutex.WaitOne(0)
        if (-not $ownsValidationLock) {
            Write-Output 'Waiting for the other ASHEN VOW validator to release its test saves.'
            $ownsValidationLock = $validationMutex.WaitOne(1800000)
        }
    } catch [System.Threading.AbandonedMutexException] {
        $ownsValidationLock = $true
    }
    if (-not $ownsValidationLock) { throw 'Timed out waiting for the shared validation save directory.' }
    $baseArgs = @('--headless','--path',(Join-Path $repo 'game'))
    if (-not $RealTime) { $baseArgs += @('--fixed-fps',"$SimulationHz") }
    foreach ($script in @('unit_tests','campaign_logic','ui_layout','rig_tests','motion_tests')) {
        Invoke-Godot $exe ($baseArgs+@('--script',"res://tests/$script.gd")) (Join-Path $PSScriptRoot "logs\$script.log")
    }
    foreach ($mode in @('--validate-systems','--test-transitions','--test-quality','--test-trial','--test-motion-quality','--test-trial-combat','--test-trial-duel','--test-quit-transition','--test-resume-transition')) {
        $label = $mode.TrimStart('-')
        $modeArguments = @('--',$mode)
        if ($mode -eq '--test-trial') { $modeArguments += "--trial-hz=$SimulationHz" }
        if ($mode -eq '--test-motion-quality') { $modeArguments += "--motion-hz=$SimulationHz" }
        if ($mode -eq '--test-trial-combat') { $modeArguments += "--combat-hz=$SimulationHz" }
        if ($mode -eq '--test-trial-duel') { $modeArguments += "--duel-hz=$SimulationHz" }
        Invoke-Godot $exe ($baseArgs+$modeArguments) (Join-Path $PSScriptRoot "logs\$label.log")
    }
    if ($Campaign) {
        foreach ($mode in @('--campaign-play','--campaign-continue')) {
            $label = $mode.TrimStart('-')
            Invoke-Godot $exe ($baseArgs+@('--',$mode)) (Join-Path $PSScriptRoot "logs\$label.log")
        }
    }
    Write-Output 'Headless checks finished. No game window or desktop input capture was used.'
} finally {
    if ($ownsValidationLock) { $validationMutex.ReleaseMutex() }
    $validationMutex.Dispose()
}
