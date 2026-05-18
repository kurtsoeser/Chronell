#Requires -Version 5.1
<#
.SYNOPSIS
  Kopiert den Windows-Installer nach docs/release/ für GitHub Pages-Downloads.

.EXAMPLE
  .\scripts\publish-docs-release.ps1
  .\scripts\publish-docs-release.ps1 -Version 0.9.8 -NoOpen
#>
[CmdletBinding()]
param(
  [string] $Version,
  [switch] $NoOpen
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $repoRoot

function Read-PackageVersion {
  $pkg = Get-Content -LiteralPath (Join-Path $repoRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  return [string] $pkg.version
}

function Find-SetupExe([string] $Ver) {
  $candidates = @(
    (Join-Path $repoRoot "release\$Ver\Chronell-$Ver-setup.exe"),
    (Join-Path $repoRoot "release\$Ver\Chronell Setup $Ver.exe")
  )
  foreach ($path in $candidates) {
    if (Test-Path -LiteralPath $path) { return (Resolve-Path -LiteralPath $path).Path }
  }
  $found = Get-ChildItem -Path (Join-Path $repoRoot 'release') -Recurse -Filter 'Chronell-*-setup.exe' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if ($found) { return $found.FullName }
  return $null
}

if (-not $Version) { $Version = Read-PackageVersion }

$setupExe = Find-SetupExe $Version
if (-not $setupExe) {
  throw "Kein Setup gefunden. Zuerst: npm run build:win (Version $Version)"
}

$docsRelease = Join-Path $repoRoot 'docs\release'
$versionDir = Join-Path $docsRelease $Version
$latestDir = Join-Path $docsRelease 'latest'
$stableName = 'Chronell-setup.exe'
$versionedName = "Chronell-$Version-setup.exe"

New-Item -ItemType Directory -Force -Path $versionDir, $latestDir | Out-Null

Copy-Item -LiteralPath $setupExe -Destination (Join-Path $versionDir $versionedName) -Force
Copy-Item -LiteralPath $setupExe -Destination (Join-Path $latestDir $stableName) -Force

$appVersionTs = Join-Path $repoRoot 'src\shared\app-version.ts'
$releasedAt = (Get-Date -Format 'yyyy-MM-dd')
if (Test-Path -LiteralPath $appVersionTs) {
  $raw = Get-Content -LiteralPath $appVersionTs -Raw -Encoding UTF8
  if ($raw -match "APP_RELEASE_DATE_ISO = '([^']+)'") {
    $releasedAt = $Matches[1]
  }
}

$manifest = [ordered]@{
  version      = $Version
  releasedAt   = $releasedAt
  beta         = $true
  filename     = $stableName
  stableUrl    = 'release/latest/Chronell-setup.exe'
  versionedUrl = "release/$Version/$versionedName"
}
$manifestPath = Join-Path $docsRelease 'latest.json'
$manifest | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding UTF8

Write-Host ''
Write-Host 'Installer für Homepage bereit:' -ForegroundColor Green
Write-Host "  Version:  $Version"
Write-Host "  Stabil:   docs/release/latest/$stableName"
Write-Host "  Archiv:   docs/release/$Version/$versionedName"
Write-Host "  Manifest: docs/release/latest.json"
Write-Host ''
Write-Host 'Als Nächstes: docs/release committen und pushen (GitHub Pages).' -ForegroundColor DarkGray

if (-not $NoOpen) {
  Start-Process -FilePath 'explorer.exe' -ArgumentList @($docsRelease)
}
