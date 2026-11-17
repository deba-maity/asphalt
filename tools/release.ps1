param([string]$GodotPath, [string]$TemplateDirectory, [string]$OutputDirectory, [string]$SigningThumbprint, [string]$TimestampUrl)
. (Join-Path $PSScriptRoot 'common.ps1')
$exe=Resolve-Godot $GodotPath
$null=Get-MatchingTemplates $TemplateDirectory
$config=Get-Content -LiteralPath (Join-Path $script:RepoRoot 'release-config.json') -Raw | ConvertFrom-Json
if (-not $OutputDirectory) { $OutputDirectory=Join-Path $script:RepoRoot "exports\releases\v$($config.version)" }
& (Join-Path $PSScriptRoot 'test.ps1') -GodotPath $exe -Campaign
if ($LASTEXITCODE -ne 0) { throw 'Source checks failed.' }
$testsFile=Join-Path $PSScriptRoot 'logs\source-tests-60.json'
& (Join-Path $PSScriptRoot 'build.ps1') -GodotPath $exe -TemplateDirectory $TemplateDirectory
$binary=Join-Path $script:RepoRoot 'exports\windows\AshenVow.exe'
$signed=$false
if ($SigningThumbprint) {
    if (-not $TimestampUrl -or $TimestampUrl -notmatch '^https?://') { throw 'Pass the timestamp URL supplied by your code-signing provider.' }
    $certificate=Get-Item -LiteralPath "Cert:\CurrentUser\My\$SigningThumbprint"
    $result=Set-AuthenticodeSignature -FilePath $binary -Certificate $certificate -HashAlgorithm SHA256 -TimestampServer $TimestampUrl
    if ($result.Status -ne 'Valid') { throw "Signing did not validate: $($result.Status)" }
    $signed=$true
    & python (Join-Path $PSScriptRoot 'source_identity.py') build $binary (Join-Path $script:RepoRoot 'exports\windows\build-identity.json')
    if ($LASTEXITCODE -ne 0) { throw 'Signed binary identity recording failed.' }
}
$packageArgs=@((Join-Path $PSScriptRoot 'package_release.py'),'--output',$OutputDirectory,'--source-tests',$testsFile)
if ($signed) { $packageArgs+='--signed' }
& python @packageArgs
if ($LASTEXITCODE -ne 0) { throw 'Portable packaging failed.' }
& python (Join-Path $PSScriptRoot 'verify_portable.py') --release-dir $OutputDirectory
if ($LASTEXITCODE -ne 0) { throw 'Fresh ZIP verification failed.' }
& python (Join-Path $PSScriptRoot 'site_release.py') --release (Join-Path $OutputDirectory 'release.json')
if ($LASTEXITCODE -ne 0) { throw 'Site release-data generation failed.' }
Write-Output "Candidate ready: $OutputDirectory. Unsigned unless explicitly signed above. No publication was performed."
