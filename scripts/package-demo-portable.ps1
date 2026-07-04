#Requires -Version 5.1
<#
.SYNOPSIS
  Erstellt ein portable Demo-ZIP aus win-unpacked (nach npm run build:win).

  Ausgabe: release/<version>/Chronell-<version>-Demo-Portable.zip
  Enthält Chronell.exe + Chronell Demo.bat (--demo) + README.

  Beispiel:
    npm run build:win:local
    npm run demo:package-portable
#>
param(
  [string] $Version = '',
  [string] $WinUnpacked = ''
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

function Get-AppVersion {
  $pkg = Get-Content (Join-Path $repoRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  return [string] $pkg.version
}

if (-not $Version) { $Version = Get-AppVersion }

if (-not $WinUnpacked) {
  $candidates = @(
    (Join-Path $repoRoot "release\$Version\win-unpacked"),
    (Join-Path $repoRoot 'release\win-unpacked')
  )
  foreach ($c in $candidates) {
    if (Test-Path -LiteralPath (Join-Path $c 'Chronell.exe')) {
      $WinUnpacked = $c
      break
    }
  }
}

if (-not $WinUnpacked -or -not (Test-Path -LiteralPath (Join-Path $WinUnpacked 'Chronell.exe'))) {
  Write-Error "win-unpacked nicht gefunden. Zuerst: npm run build:win:local`nErwartet: release\$Version\win-unpacked\Chronell.exe"
}

$outDir = Join-Path $repoRoot "release\$Version"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$staging = Join-Path $env:TEMP "chronell-demo-portable-$Version"
if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
New-Item -ItemType Directory -Force -Path $staging | Out-Null

Write-Host "[demo:package-portable] Kopiere $WinUnpacked -> $staging"
Copy-Item -LiteralPath (Join-Path $WinUnpacked '*') -Destination $staging -Recurse -Force

$batSrc = Join-Path $repoRoot 'resources\demo\Chronell-Demo.bat'
Copy-Item -LiteralPath $batSrc -Destination (Join-Path $staging 'Chronell Demo.bat') -Force

$readme = @"
Chronell Demo (Portable)
========================

1. Ordner beliebig entpacken (z. B. USB-Stick oder Desktop)
2. Doppelklick auf "Chronell Demo.bat"
3. Die App startet mit fiktiven Demo-Daten (Szenario Nordlicht Consulting)

Profilordner: %AppData%\Chronell-Demo
Zurücksetzen: In der App über Banner oder Einstellungen

Online-Demo: https://chronell.app/demo/
Version: $Version
"@
Set-Content -LiteralPath (Join-Path $staging 'README-Demo.txt') -Value $readme -Encoding UTF8

$zipName = "Chronell-$Version-Demo-Portable.zip"
$zipPath = Join-Path $outDir $zipName
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }

Write-Host "[demo:package-portable] Erzeuge $zipPath"
Compress-Archive -LiteralPath (Join-Path $staging '*') -DestinationPath $zipPath -Force
Remove-Item -LiteralPath $staging -Recurse -Force

Write-Host "[demo:package-portable] Fertig: $zipPath" -ForegroundColor Green
