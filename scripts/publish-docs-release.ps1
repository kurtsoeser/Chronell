#Requires -Version 5.1
<#
.SYNOPSIS
  Kopiert den Windows-Installer nach docs/release/ für GitHub Pages-Downloads.

.EXAMPLE
  .\scripts\publish-docs-release.ps1
  .\scripts\publish-docs-release.ps1 -Version 0.9.8 -NoOpen
  .\scripts\publish-docs-release.ps1 -IndexOnly
#>
[CmdletBinding()]
param(
  [string] $Version,
  [switch] $NoOpen,
  [switch] $IndexOnly
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

$docsRelease = Join-Path $repoRoot 'docs\release'
$latestDir = Join-Path $docsRelease 'latest'
$stableName = 'Chronell-setup.exe'

function Get-DocsReleaseVersions {
  $dirs = Get-ChildItem -LiteralPath $docsRelease -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' }
  return $dirs | Sort-Object { [version]$_.Name } -Descending
}

if (-not $Version) {
  $sorted = Get-DocsReleaseVersions
  if ($sorted.Count -gt 0) {
    $Version = $sorted[0].Name
  } else {
    $Version = Read-PackageVersion
  }
}

if (-not $IndexOnly) {
  $setupExe = Find-SetupExe $Version
  if (-not $setupExe) {
    throw "Kein Setup gefunden. Zuerst: npm run build:win (Version $Version)"
  }

  $versionDir = Join-Path $docsRelease $Version
  $versionedName = "Chronell-$Version-setup.exe"

  New-Item -ItemType Directory -Force -Path $versionDir, $latestDir | Out-Null

  Copy-Item -LiteralPath $setupExe -Destination (Join-Path $versionDir $versionedName) -Force
  Copy-Item -LiteralPath $setupExe -Destination (Join-Path $latestDir $stableName) -Force
} elseif (-not (Test-Path -LiteralPath (Join-Path $latestDir $stableName))) {
  $versionedName = "Chronell-$Version-setup.exe"
  $fromVersioned = Join-Path $docsRelease "$Version\$versionedName"
  if (Test-Path -LiteralPath $fromVersioned) {
    New-Item -ItemType Directory -Force -Path $latestDir | Out-Null
    Copy-Item -LiteralPath $fromVersioned -Destination (Join-Path $latestDir $stableName) -Force
  }
}

$appVersionTs = Join-Path $repoRoot 'src\shared\app-version.ts'
$releasedAt = (Get-Date -Format 'yyyy-MM-dd')
if (Test-Path -LiteralPath $appVersionTs) {
  $raw = Get-Content -LiteralPath $appVersionTs -Raw -Encoding UTF8
  if ($raw -match "APP_RELEASE_DATE_ISO = '([^']+)'") {
    $releasedAt = $Matches[1]
  }
}

$versionedName = "Chronell-$Version-setup.exe"
$ghTag = "v$Version"
$ghDownloadUrl = "https://github.com/kurtsoeser/Chronell/releases/download/$ghTag/$versionedName"

$manifest = [ordered]@{
  version      = $Version
  releasedAt   = $releasedAt
  beta         = $true
  filename     = $stableName
  downloadUrl  = $ghDownloadUrl
  stableUrl    = 'release/latest/Chronell-setup.exe'
  versionedUrl = "release/$Version/$versionedName"
}
$manifestPath = Join-Path $docsRelease 'latest.json'
$manifest | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding UTF8

$versionRows = @()
foreach ($dir in Get-DocsReleaseVersions) {
  $ver = $dir.Name
  $exeName = "Chronell-$ver-setup.exe"
  $exePath = Join-Path $dir.FullName $exeName
  if (-not (Test-Path -LiteralPath $exePath)) { continue }
  $versionRows += [ordered]@{
    version     = $ver
    setupUrl    = "release/$ver/$exeName"
    downloadUrl = "https://github.com/kurtsoeser/Chronell/releases/download/v$ver/$exeName"
  }
}

$versionsManifest = [ordered]@{
  latest      = $Version
  beta        = $true
  downloadUrl = $ghDownloadUrl
  stableUrl   = 'release/latest/Chronell-setup.exe'
  versions    = @($versionRows)
}
$versionsPath = Join-Path $docsRelease 'versions.json'
$versionsManifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $versionsPath -Encoding UTF8

Write-Host ''
Write-Host 'Installer für Homepage bereit:' -ForegroundColor Green
Write-Host "  Version:  $Version"
Write-Host "  Stabil:   docs/release/latest/$stableName"
Write-Host "  Archiv:   docs/release/$Version/$versionedName"
Write-Host "  Manifest: docs/release/latest.json"
Write-Host "  Index:    docs/release/versions.json"
Write-Host ''
Write-Host 'Als Nächstes: docs/release committen und pushen (GitHub Pages).' -ForegroundColor DarkGray

if (-not $IndexOnly) {
  $setupForRelease = Join-Path $versionDir $versionedName
  if (-not (Test-Path -LiteralPath $setupForRelease)) {
    $setupForRelease = Join-Path $latestDir $stableName
  }
  if (Test-Path -LiteralPath $setupForRelease) {
    Write-Host ''
    Write-Host 'GitHub Release (optional, empfohlen als Spiegel):' -ForegroundColor Cyan
    $ghReleaseArgs = @(
      'release', 'upload', $ghTag, $setupForRelease,
      '--clobber',
      '--repo', 'kurtsoeser/Chronell'
    )
    $ghCreateArgs = @(
      'release', 'create', $ghTag,
      '--title', "Chronell $Version",
      '--notes', "Windows-11-Beta-Installer für Chronell $Version.",
      '--repo', 'kurtsoeser/Chronell'
    )
    $create = Start-Process -FilePath 'gh' -ArgumentList $ghCreateArgs -Wait -PassThru -NoNewWindow
    if ($create.ExitCode -ne 0) {
      Write-Host '  gh release create übersprungen (Tag existiert evtl. schon).' -ForegroundColor DarkYellow
    }
    $upload = Start-Process -FilePath 'gh' -ArgumentList $ghReleaseArgs -Wait -PassThru -NoNewWindow
    if ($upload.ExitCode -eq 0) {
      Write-Host "  GitHub: $ghDownloadUrl" -ForegroundColor Green
    } else {
      Write-Host '  gh release upload fehlgeschlagen — nur GitHub Pages nutzen.' -ForegroundColor Yellow
    }
  }
}

if (-not $NoOpen) {
  Start-Process -FilePath 'explorer.exe' -ArgumentList @($docsRelease)
}
