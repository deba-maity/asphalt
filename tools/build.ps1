param([string]$GodotPath, [string]$TemplateDirectory, [string]$OutputDirectory)
. (Join-Path $PSScriptRoot 'common.ps1')
Assert-BuildPython
$exe = Resolve-Godot $GodotPath
$templates = Get-MatchingTemplates $TemplateDirectory
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $script:RepoRoot 'exports\windows' }
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$output = (Resolve-Path -LiteralPath $OutputDirectory).Path
$config = Get-Content -LiteralPath (Join-Path $script:RepoRoot 'release-config.json') -Raw | ConvertFrom-Json
$rcedit = Join-Path $PSScriptRoot 'cache\rcedit-x64.exe'
if (-not (Test-Path -LiteralPath $rcedit)) { throw 'Missing pinned resource editor. Run tools\setup.ps1 -ReleaseTools.' }
if ((Get-FileHash -LiteralPath $rcedit -Algorithm SHA256).Hash.ToLowerInvariant() -ne $script:EnginePin.rcedit.sha256) { throw 'rcedit integrity check failed; re-run setup after removing only that cached file.' }
& python (Join-Path $PSScriptRoot 'prepare_export.py') --templates $templates
if ($LASTEXITCODE -ne 0) { throw 'Export preparation failed. Read the Python error above.' }
try {
    Invoke-Godot $exe @('--headless','--path',(Join-Path $script:RepoRoot 'game'),'--editor','--import','--quit') (Join-Path $PSScriptRoot 'logs\build-import.log')
    Invoke-Godot $exe @('--headless','--path',(Join-Path $script:RepoRoot 'game'),'--export-release','Windows Preview',(Join-Path $output 'AshenVow.exe')) (Join-Path $PSScriptRoot 'logs\export.log')
} finally {
    & python (Join-Path $PSScriptRoot 'prepare_export.py') --restore
}
$binary = Join-Path $output 'AshenVow.exe'
$numeric = ($config.version -split '-')[0] + '.1'
& $rcedit $binary --set-icon (Join-Path $script:RepoRoot 'game\assets\branding\ashen-vow.ico') --set-file-version $numeric --set-product-version $numeric --set-version-string ProductName 'ASHEN VOW' --set-version-string FileDescription 'ASHEN VOW native campaign candidate'
if ($LASTEXITCODE -ne 0) { throw 'Windows icon/version stamping failed.' }
foreach ($file in @('LICENSE','docs\GODOT_LICENSE.txt','docs\THIRD_PARTY_NOTICES.txt','docs\CREDITS.txt','docs\PERFORMANCE_ASSET_LICENSE.txt','docs\COURT_ASSET_LICENSE.txt','docs\TRIAL_AUDIO_LICENSE.txt','game\assets\type\OFL.txt')) {
    Copy-Item -LiteralPath (Join-Path $script:RepoRoot $file) -Destination $output
}
Get-FileHash -LiteralPath $binary -Algorithm SHA256 | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $output 'build-hash.json')
& python (Join-Path $PSScriptRoot 'source_identity.py') build $binary (Join-Path $output 'build-identity.json')
if ($LASTEXITCODE -ne 0) { throw 'Build source identity recording failed.' }
Write-Output "Built $binary ($($config.version), unsigned)."
