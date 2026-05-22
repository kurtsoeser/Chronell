#Requires -Version 5.1
<#
.SYNOPSIS
  Setzt statische Download-Fallback-Links in docs/index.html auf die aktuelle Release-URL.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string] $Version
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$indexPath = Join-Path $repoRoot 'docs\index.html'
if (-not (Test-Path -LiteralPath $indexPath)) { return }

$downloadUrl = "https://github.com/kurtsoeser/Chronell/releases/download/v$Version/Chronell-$Version-setup.exe"
$raw = Get-Content -LiteralPath $indexPath -Raw -Encoding UTF8

$updated = $raw -replace 'https://github\.com/kurtsoeser/Chronell/releases/download/v[0-9]+\.[0-9]+\.[0-9]+/Chronell-[0-9]+\.[0-9]+\.[0-9]+-setup\.exe', $downloadUrl
$updated = $updated -replace 'href="#"([^>]*data-download)', "href=`"$downloadUrl`"`$1"

if ($updated -ne $raw) {
  [System.IO.File]::WriteAllText($indexPath, $updated, [System.Text.UTF8Encoding]::new($false))
  Write-Host "  index.html: Download-Fallback -> v$Version" -ForegroundColor DarkGray
}
