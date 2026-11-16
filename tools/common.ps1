$ErrorActionPreference = 'Stop'
$script:RepoRoot = Split-Path -Parent $PSScriptRoot
$script:EnginePin = Get-Content -LiteralPath (Join-Path $script:RepoRoot 'engine-version.json') -Raw | ConvertFrom-Json

function Resolve-Godot([string]$GodotPath) {
    if ($GodotPath -and -not (Test-Path -LiteralPath $GodotPath -PathType Leaf)) { throw "Explicit Godot executable does not exist: '$GodotPath'. Pass its actual full path." }
    $candidates = @($GodotPath, $env:GODOT_EXE, (Join-Path $PSScriptRoot "engine\Godot_v$($script:EnginePin.version)-stable_win64_console.exe"))
    foreach ($name in @('godot','godot4')) {
        $found = Get-Command $name -ErrorAction SilentlyContinue
        if ($found) { $candidates += $found.Source }
    }
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            $resolved = (Resolve-Path -LiteralPath $candidate).Path
            $actual = & $resolved --version
            if ($LASTEXITCODE -ne 0 -or $actual -notmatch "^$([regex]::Escape($script:EnginePin.version))\.stable\.") {
                throw "Wrong Godot version at '$resolved': $actual. Install standard $($script:EnginePin.version) stable or pass -GodotPath."
            }
            if ($actual -match 'mono') { throw 'Use the standard GDScript build, not .NET.' }
            return $resolved
        }
    }
    throw 'Godot was not found. Run tools\setup.ps1, set GODOT_EXE, or pass -GodotPath with the exact executable path.'
}

function Invoke-Godot([string]$Exe, [string[]]$Arguments, [string]$LogPath) {
    if (-not $LogPath) { $LogPath = Join-Path $script:RepoRoot 'tools\logs\last-engine.log' }
    New-Item -ItemType Directory -Path (Split-Path -Parent $LogPath) -Force | Out-Null
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { $output = & $Exe @Arguments 2>&1; $code = $LASTEXITCODE } finally { $ErrorActionPreference = $previous }
    $output | ForEach-Object { $_.ToString() } | Set-Content -Encoding UTF8 -LiteralPath $LogPath
    if ($code -ne 0 -or (($output | Out-String) -match '(?m)(SCRIPT ERROR:|ERROR:|FAIL:)')) {
        Get-Content -LiteralPath $LogPath -Tail 24 | Write-Output
        throw "Godot check failed (exit $code). Read '$LogPath'."
    }
    Write-Output "Passed: $LogPath"
}

function Get-MatchingTemplates([string]$TemplateDirectory) {
    if (-not $TemplateDirectory) { $TemplateDirectory = Join-Path $PSScriptRoot "export_templates\$($script:EnginePin.export_templates)" }
    foreach ($entry in $script:EnginePin.template_sha256.PSObject.Properties) {
        if ($entry.Name -notlike 'windows_*') { continue }
        $path = Join-Path $TemplateDirectory $entry.Name
        if (-not (Test-Path -LiteralPath $path)) { throw "Missing '$path'. Run tools\setup.ps1 -Templates or pass -TemplateDirectory pointing to matching standard templates." }
        if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.Value) { throw "Template integrity/version mismatch: $path. Re-fetch the pinned official templates." }
    }
    return (Resolve-Path -LiteralPath $TemplateDirectory).Path
}
