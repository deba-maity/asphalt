param([switch]$Headless, [int]$Minutes = 15)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $repo 'exports\windows\AshenVow.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw 'Build the Windows preview first: tools\build.ps1' }
$form = Join-Path $repo 'benchmark-environment.json'
if (-not (Test-Path -LiteralPath $form)) { Copy-Item -LiteralPath (Join-Path $repo 'benchmark-environment.example.json') -Destination $form }
$userData = Join-Path $env:APPDATA 'AshenVow'
New-Item -ItemType Directory -Path $userData -Force | Out-Null
Copy-Item -LiteralPath $form -Destination (Join-Path $userData 'benchmark-environment.json')
$seconds = [Math]::Max(30,[Math]::Min(3600,$Minutes*60))
$runArgs = @('--','--campaign-play','--benchmark','--benchmark-route',"--benchmark-seconds=$seconds")
if ($Headless) { $runArgs = @('--headless')+$runArgs }
$log = Join-Path $repo 'tools\logs\benchmark'
New-Item -ItemType Directory -Path $log -Force | Out-Null
# Graphical invocation is an explicit local user action. No OS settings are changed.
$style = if ($Headless) { 'Hidden' } else { 'Normal' }
$proc = Start-Process -FilePath $exe -ArgumentList $runArgs -WindowStyle $style -PassThru
$rows = [Collections.Generic.List[object]]::new()
while (-not $proc.HasExited) {
    $proc.Refresh()
    $rows.Add([pscustomobject]@{time_utc=[DateTime]::UtcNow.ToString('o'); working_set_bytes=$proc.WorkingSet64; private_bytes=$proc.PrivateMemorySize64; cpu_seconds=$proc.TotalProcessorTime.TotalSeconds})
    Start-Sleep -Seconds 1
}
$rows | Export-Csv -LiteralPath (Join-Path $log 'process-memory.csv') -NoTypeInformation
Write-Output "Exit $($proc.ExitCode). Engine reports: $userData\benchmarks; process samples: $log\process-memory.csv"
