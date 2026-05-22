#Requires -Version 5.1
<#
.SYNOPSIS
  Committet docs/release (LFS) und pusht nach origin — fuer automatischen Homepage-Deploy.

.PARAMETER Version
  Versionsnummer fuer die Commit-Nachricht.

.EXAMPLE
  .\scripts\push-release-to-github.ps1 -Version 0.9.21
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string] $Version
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $repoRoot

if ($env:CHRONELL_SKIP_GIT_PUSH -eq '1') {
  Write-Host 'Git-Push uebersprungen (CHRONELL_SKIP_GIT_PUSH=1).' -ForegroundColor DarkGray
  exit 0
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host 'git nicht gefunden — Push uebersprungen.' -ForegroundColor Yellow
  exit 0
}

& (Join-Path $PSScriptRoot 'ensure-git-lfs.ps1') | Out-Null

$branch = (git rev-parse --abbrev-ref HEAD 2>$null).Trim()
if (-not $branch) {
  Write-Host 'Kein Git-Branch — Push uebersprungen.' -ForegroundColor Yellow
  exit 0
}

git add .gitattributes docs/release package.json src/shared/app-version.ts docs/index.html 2>$null

$porcelain = git status --porcelain 2>$null
if (-not $porcelain) {
  Write-Host 'Keine Aenderungen zum Pushen — bereits aktuell.' -ForegroundColor DarkGray
  exit 0
}

$msg = ('Release {0}: Installer, Manifeste und Homepage' -f $Version)
git commit -m $msg
if ($LASTEXITCODE -ne 0) {
  Write-Host 'git commit fehlgeschlagen.' -ForegroundColor Yellow
  exit $LASTEXITCODE
}

Write-Host ''
Write-Host "Pushe nach origin/$branch (inkl. Git LFS) ..." -ForegroundColor Cyan
git push origin $branch
if ($LASTEXITCODE -ne 0) {
  Write-Host 'git push fehlgeschlagen — pruefe Netzwerk und gh/git-Anmeldung.' -ForegroundColor Yellow
  exit $LASTEXITCODE
}

Write-Host 'GitHub Pages aktualisiert sich in 1–3 Minuten.' -ForegroundColor Green
Write-Host 'Download (sofort): GitHub Releases' -ForegroundColor Green
