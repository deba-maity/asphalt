$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$pin = Get-Content -LiteralPath (Join-Path $repo 'engine-version.json') -Raw | ConvertFrom-Json
$exe = Join-Path $PSScriptRoot "engine\Godot_v$($pin.version)-stable_win64_console.exe"
$actual = & $exe --version
if ($actual -notlike "$($pin.version).stable.*") { throw 'Engine version does not match pin.' }
$template = Join-Path $PSScriptRoot "export_templates\$($pin.version).stable\windows_release_x86_64.exe"
if (-not (Test-Path -LiteralPath $template)) {
    & python (Join-Path $PSScriptRoot 'fetch_windows_templates.py')
    if ($LASTEXITCODE -ne 0) { throw 'Template fetch failed.' }
}
$output = Join-Path $repo 'exports\windows'
New-Item -ItemType Directory -Path $output -Force | Out-Null
& $exe --headless --path (Join-Path $repo 'game') --editor --import --quit
if ($LASTEXITCODE -ne 0) { throw 'Asset import failed.' }
& $exe --headless --path (Join-Path $repo 'game') --export-release 'Windows Preview' (Join-Path $output 'AshenVow.exe')
if ($LASTEXITCODE -ne 0) { throw 'Windows export failed.' }
Copy-Item -LiteralPath (Join-Path $repo 'LICENSE') -Destination $output
Copy-Item -LiteralPath (Join-Path $repo 'docs\GODOT_LICENSE.txt') -Destination $output
Copy-Item -LiteralPath (Join-Path $repo 'docs\THIRD_PARTY_NOTICES.txt') -Destination $output
Get-FileHash -LiteralPath (Join-Path $output 'AshenVow.exe') -Algorithm SHA256 | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $output 'build-hash.json')
Write-Output "Built $output\AshenVow.exe"
