#Requires -Version 5.1
<#
.SYNOPSIS
  Stellt sicher, dass Git LFS fuer docs/release/**/*.exe aktiv ist.
#>
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $repoRoot

if (-not (Get-Command git-lfs -ErrorAction SilentlyContinue)) {
  Write-Host 'Git LFS nicht installiert: https://git-lfs.github.com/' -ForegroundColor Yellow
  return $false
}

git lfs install 2>&1 | Out-Null
$attrsPath = Join-Path $repoRoot '.gitattributes'
$trackLine = 'docs/release/**/*.exe filter=lfs'
$raw = if (Test-Path -LiteralPath $attrsPath) {
  Get-Content -LiteralPath $attrsPath -Raw -Encoding UTF8
} else {
  ''
}

if ($raw -notmatch [regex]::Escape('docs/release/**/*.exe')) {
  if ($raw -and -not $raw.EndsWith("`n")) { $raw += "`n" }
  if ($raw) { $raw += "`n" }
  $raw += "# Installer per Git LFS (GitHub Releases = oeffentlicher Download).`n$trackLine diff=lfs merge=lfs -text`n"
  [System.IO.File]::WriteAllText($attrsPath, $raw, [System.Text.UTF8Encoding]::new($false))
  git lfs track 'docs/release/**/*.exe' 2>&1 | Out-Null
}

return $true
