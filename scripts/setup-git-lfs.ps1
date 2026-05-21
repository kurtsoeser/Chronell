#Requires -Version 5.1
<#
.SYNOPSIS
  Aktiviert Git LFS fuer docs/release/*.exe (Fallback wenn Installer >100 MB bleibt).

.EXAMPLE
  .\scripts\setup-git-lfs.ps1
#>
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $repoRoot

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw 'git nicht gefunden.'
}

if (-not (Get-Command git-lfs -ErrorAction SilentlyContinue)) {
  Write-Host 'Git LFS ist nicht installiert: https://git-lfs.github.com/' -ForegroundColor Yellow
  exit 1
}

git lfs install
git lfs track 'docs/release/**/*.exe'
Write-Host ''
Write-Host 'Git LFS fuer Installer aktiviert (.gitattributes).' -ForegroundColor Green
Write-Host 'Falls EXEs schon ohne LFS committed wurden, vor dem Push:' -ForegroundColor DarkGray
Write-Host '  git rm --cached docs/release/**/*.exe' -ForegroundColor DarkGray
Write-Host '  git add docs/release .gitattributes' -ForegroundColor DarkGray
Write-Host ''
Write-Host 'Hinweis: GitHub Pages liefert LFS-Dateien oft nicht als direkten Download — Installer <100 MB ist besser.' -ForegroundColor Yellow
