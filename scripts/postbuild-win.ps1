#Requires -Version 5.1
<#
.SYNOPSIS
  Nach erfolgreichem Windows-Build: optional Homepage + GitHub Release veroeffentlichen.

.DESCRIPTION
  Wird von npm run build:win nach build:win:inner aufgerufen (via run-finish-win-build.mjs).
  Fragt interaktiv, ob der Installer nach docs/release kopiert und als GitHub Release hochgeladen wird.

.EXAMPLE
  .\scripts\postbuild-win.ps1

.EXAMPLE
  .\scripts\postbuild-win.ps1 -NoPrompt

.EXAMPLE
  .\scripts\postbuild-win.ps1 -PublishGitHub
#>
[CmdletBinding()]
param(
  [switch] $NoPrompt,
  [switch] $PublishGitHub,
  [switch] $SkipPublish
)

$ErrorActionPreference = 'Stop'

function Write-Step([string] $Message) {
  Write-Host ''
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Get-RepoRoot {
  $root = Resolve-Path (Join-Path $PSScriptRoot '..')
  return $root.Path
}

function Read-PackageVersion([string] $PackageJsonPath) {
  $pkg = Get-Content -LiteralPath $PackageJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
  if (-not $pkg.version) {
    throw "Keine version in $PackageJsonPath gefunden."
  }
  return [string] $pkg.version
}

function Test-InteractivePrompt {
  if ($env:CI -eq 'true' -or $env:CI -eq '1') {
    return $false
  }
  if ($env:CHRONELL_NO_PUBLISH_PROMPT -eq '1') {
    return $false
  }
  return [Environment]::UserInteractive
}

function Read-PublishGitHubChoice([string] $Version) {
  Write-Host ''
  Write-Host ('Build abgeschlossen - Version ' + $Version) -ForegroundColor Green
  Write-Host ''
  Write-Host '  [J] Auf GitHub veroeffentlichen' -ForegroundColor Green
  Write-Host '      Installer nach docs/release kopieren, Manifeste aktualisieren, GitHub Release hochladen'
  Write-Host '  [N] Nur lokal behalten' -ForegroundColor Yellow
  Write-Host '      Installer liegt unter release/<version>/ (kein Upload)'
  Write-Host ''
  Write-Host '  Hinweis: docs/release/ danach committen und pushen (Git LFS); Download via GitHub Releases.' -ForegroundColor DarkGray
  Write-Host ''

  while ($true) {
    $raw = Read-Host 'Auf GitHub veroeffentlichen? [J/n]'
    if ($null -eq $raw) {
      Write-Host 'Keine Eingabe moeglich (nicht-interaktiv): kein Upload.' -ForegroundColor DarkGray
      return $false
    }
    $answer = $raw.Trim()
    if ($answer -eq '' -or $answer -match '^(j|ja|y|yes)$') {
      return $true
    }
    if ($answer -match '^(n|nein|no)$') {
      return $false
    }
    Write-Host 'Bitte J (veroeffentlichen) oder N (nur lokal) eingeben.' -ForegroundColor Yellow
  }
}

# --- main ---
$repoRoot = Get-RepoRoot
Set-Location -LiteralPath $repoRoot

$version = Read-PackageVersion (Join-Path $repoRoot 'package.json')
$hasInstaller = $false
$installerPath = ''
$setupCandidates = @(
  (Join-Path $repoRoot ('release\' + $version + '\Chronell-' + $version + '-setup.exe')),
  (Join-Path $repoRoot ('release\' + $version + '\Chronell Setup ' + $version + '.exe'))
)
foreach ($candidate in $setupCandidates) {
  if (-not (Test-Path -LiteralPath $candidate)) { continue }
  $installerPath = (Resolve-Path -LiteralPath $candidate).Path
  $hasInstaller = $true
  break
}

if (-not $hasInstaller) {
  Write-Host ('Kein Setup unter release\' + $version + ' gefunden - Veroeffentlichung uebersprungen.') -ForegroundColor Yellow
  exit 0
}

$wantPublish = $false
if ($PublishGitHub) {
  $wantPublish = $true
} elseif ($SkipPublish) {
  $wantPublish = $false
} elseif ($NoPrompt -or -not (Test-InteractivePrompt)) {
  $wantPublish = $false
} else {
  $wantPublish = Read-PublishGitHubChoice -Version $version
}

if (-not $wantPublish) {
  Write-Host ''
  Write-Host ('Lokaler Installer: ' + $installerPath) -ForegroundColor DarkGray
  Write-Host 'Spaeter veroeffentlichen: npm run publish:docs-release' -ForegroundColor DarkGray
  exit 0
}

Write-Step ('Veroeffentlichen: docs/release + GitHub Release (v' + $version + ')')
$publishScript = Join-Path $PSScriptRoot 'publish-docs-release.ps1'
& $publishScript -Version $version

if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ''
Write-Host 'Naechster Schritt: docs/release/ committen und pushen (Git LFS + GitHub Releases).' -ForegroundColor Cyan
