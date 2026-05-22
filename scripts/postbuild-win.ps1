#Requires -Version 5.1
<#
.SYNOPSIS
  Nach erfolgreichem Windows-Build: Homepage, GitHub Release und Git-Push automatisch.

.DESCRIPTION
  Wird von npm run build:win nach build:win:inner aufgerufen (via run-finish-win-build.mjs).
  Standard: alles automatisch (kein zweites Nachfragen).
  Nur lokal bauen: CHRONELL_SKIP_PUBLISH=1 oder npm run build:win:local

.EXAMPLE
  .\scripts\postbuild-win.ps1

.EXAMPLE
  .\scripts\postbuild-win.ps1 -SkipPublish
#>
[CmdletBinding()]
param(
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
  Write-Host ('Kein Setup unter release\' + $version + ' gefunden — Veroeffentlichung uebersprungen.') -ForegroundColor Yellow
  exit 0
}

if ($SkipPublish -or $env:CHRONELL_SKIP_PUBLISH -eq '1') {
  Write-Host ''
  Write-Host ('Lokaler Installer: ' + $installerPath) -ForegroundColor DarkGray
  Write-Host 'Veroeffentlichung uebersprungen (CHRONELL_SKIP_PUBLISH oder -SkipPublish).' -ForegroundColor DarkGray
  exit 0
}

$env:CHRONELL_AUTO_RELEASE = '1'

Write-Step ('Automatische Veroeffentlichung v' + $version)
Write-Host '  1/3 Installer + Manifeste + GitHub Release' -ForegroundColor DarkGray
Write-Host '  2/3 Homepage-Download-URLs' -ForegroundColor DarkGray
Write-Host '  3/3 Git commit + push (Git LFS, GitHub Pages)' -ForegroundColor DarkGray
Write-Host ''

$publishScript = Join-Path $PSScriptRoot 'publish-docs-release.ps1'
& $publishScript -Version $version -NoOpen -PushGit

if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ''
Write-Host ('Fertig — Version ' + $version + ' ist online.') -ForegroundColor Green
Write-Host ('  Download: https://github.com/kurtsoeser/Chronell/releases/download/v' + $version + '/Chronell-' + $version + '-setup.exe') -ForegroundColor Green
Write-Host '  Homepage: https://kurtsoeser.github.io/Chronell/ (nach kurzer Wartezeit)' -ForegroundColor Green
