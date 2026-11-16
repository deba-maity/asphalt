param([Parameter(Mandatory=$true)][string]$Repository,[Parameter(Mandatory=$true)][string]$ReleaseDirectory,[switch]$Publish)
. (Join-Path $PSScriptRoot 'common.ps1')
if ($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { throw 'Pass the actual OWNER/REPOSITORY from GitHub Code > HTTPS.' }
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'Install GitHub CLI from https://cli.github.com/ and run gh auth login first.' }
& gh auth status
if ($LASTEXITCODE -ne 0) { throw 'GitHub authentication is unavailable.' }
$origin=& git -C $script:RepoRoot remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0 -or $origin -notmatch ('^(https://github\.com/|git@github\.com:)'+[regex]::Escape($Repository)+'(\.git)?/?$')) { throw 'Origin does not match the explicitly chosen GitHub repository. Configure and inspect it before publishing.' }
$resolved=& gh repo view $Repository --json nameWithOwner --jq .nameWithOwner
if ($LASTEXITCODE -ne 0 -or $resolved -ine $Repository) { throw 'Cannot verify repository ownership/destination.' }
& python (Join-Path $PSScriptRoot 'check_release.py') $ReleaseDirectory
if ($LASTEXITCODE -ne 0) { throw 'Local final artifact verification failed.' }
$metadata=Get-Content -LiteralPath (Join-Path $ReleaseDirectory 'release.json') -Raw | ConvertFrom-Json
$tag='v'+$metadata.version
$existing=& gh release list --repo $Repository --limit 1000 --json tagName
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect existing releases.' }
if (($existing | ConvertFrom-Json).tagName -contains $tag) { throw 'This release already exists. Never replace it; increment release-config.json and build a new candidate.' }
& gh api "repos/$Repository/commits/$($metadata.source_commit)" --silent
if ($LASTEXITCODE -ne 0) { throw 'Build source commit is not present in the destination repository. Push the reviewed source first.' }
$files=@($metadata.artifacts | ForEach-Object { Join-Path $ReleaseDirectory $_.filename })
$files+=@('release.json','portable-verification.json','SHA256SUMS.txt') | ForEach-Object { Join-Path $ReleaseDirectory $_ }
$body=Join-Path $PSScriptRoot 'cache\release-notes.txt'
New-Item -ItemType Directory -Path (Split-Path -Parent $body) -Force | Out-Null
@"
Native Windows x86_64 candidate $($metadata.version), $($metadata.signature).
Choose the windows-x86_64 ZIP to play; the source ZIP is for developers. Extract the complete archive and open AshenVow.exe. Game data is embedded. Compare SHA256SUMS.txt before launching.

Source: $($metadata.source_commit). Godot $($metadata.engine). Source and fresh-extraction headless campaign checks passed. Rendered/audio/device acceptance and Ryzen 5500U performance are NOT RUN. Short campaign; multi-hour ambition unmet. Android unavailable (no APK). See the included README and repository docs for details.
"@ | Set-Content -LiteralPath $body -Encoding UTF8
& gh release create $tag @files --repo $Repository --target $metadata.source_commit --draft --prerelease --title "ASHEN VOW $($metadata.version) - Windows candidate" --notes-file $body
if ($LASTEXITCODE -ne 0) { throw 'Draft creation/upload failed. Inspect Releases; do not overwrite any existing tag.' }
$verify=Join-Path $PSScriptRoot ('cache\remote-verification-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $verify | Out-Null
& gh release download $tag --repo $Repository --dir $verify
if ($LASTEXITCODE -ne 0) { throw 'Draft download failed. Release remains a draft.' }
& python (Join-Path $PSScriptRoot 'check_release.py') $verify
if ($LASTEXITCODE -ne 0) { throw 'Draft bytes failed verification. Release remains a draft.' }
if ($Publish) {
    & gh release edit $tag --repo $Repository --draft=false
    if ($LASTEXITCODE -ne 0) { throw 'Publication failed. Inspect the draft; do not recreate it.' }
    & python (Join-Path $PSScriptRoot 'site_release.py') --repository $Repository --tag $tag
    if ($LASTEXITCODE -ne 0) { throw 'Release was published, but anonymous public download verification failed. Do not deploy a download link until site_release.py succeeds.' }
} else { Write-Output 'Verified draft only. Inspect it in GitHub Releases. Publish from GitHub when ready, then run site_release.py --repository OWNER/REPOSITORY --tag with this exact version.' }
