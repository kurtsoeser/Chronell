#Requires -Version 5.1
<#
.SYNOPSIS
  Lokales Release: Version (optional) hochsetzen, Windows-Installer bauen, Setup bereitstellen.

.DESCRIPTION
  - Synchronisiert package.json und src/shared/app-version.ts
  - Führt npm run build:win aus (ersetzt installierte Chronell-Version per NSIS-In-Place-Upgrade)
  - Daten in %APPDATA%\Chronell bleiben erhalten

.EXAMPLE
  .\scripts\update-local.ps1
  Fragt interaktiv: neue Version oder gleiche Version neu bauen.

.EXAMPLE
  .\scripts\update-local.ps1 -NoBump
  Gleiche Version neu bauen (ohne Rückfrage).

.EXAMPLE
  .\scripts\update-local.ps1 -NoPrompt
  Keine Rückfrage — Patch-Version erhöhen (wie früher).

.EXAMPLE
  .\scripts\update-local.ps1 -Bump minor -NoPrompt -RunInstaller
  Minor-Version, bauen, Setup direkt starten.
#>
[CmdletBinding()]
param(
  [ValidateSet('patch', 'minor', 'major')]
  [string] $Bump = 'patch',

  [switch] $NoBump,

  # Ohne interaktive Versions-Abfrage (z. B. CI oder explizit -Bump/-NoBump).
  [switch] $NoPrompt,

  [switch] $SkipBuild,

  [switch] $RunInstaller,

  [switch] $NoOpen,

  [switch] $Force
)

Set-StrictMode -Version Latest
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

function Invoke-PrepareWinVersion {
  param(
    [string] $Bump,
    [switch] $NoBump,
    [switch] $NoPrompt
  )

  $prepareScript = Join-Path $PSScriptRoot 'prepare-win-version.ps1'
  $cliArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $prepareScript)
  if ($NoBump) {
    $cliArgs += '-NoBump'
  }
  if ($NoPrompt) {
    $cliArgs += '-NoPrompt'
  }
  if ($PSBoundParameters.ContainsKey('Bump')) {
    $cliArgs += @('-Bump', $Bump)
  }
  & powershell.exe @cliArgs
  if ($LASTEXITCODE -ne 0) {
    throw "prepare-win-version.ps1 fehlgeschlagen (Exit-Code $LASTEXITCODE)."
  }
}

function Test-ChronellRunning {
  $names = @('Chronell', 'mailclient', 'electron')
  foreach ($name in $names) {
    $proc = Get-Process -Name $name -ErrorAction SilentlyContinue
    if ($proc) {
      return $true
    }
  }
  return $false
}

function Remove-WinUnpackedArtifact([string] $UnpackedPath) {
  if (-not (Test-Path -LiteralPath $UnpackedPath)) {
    return $true
  }
  try {
    Remove-Item -LiteralPath $UnpackedPath -Recurse -Force -ErrorAction Stop
    Write-Host "  Entfernt: $UnpackedPath" -ForegroundColor DarkGray
    return $true
  } catch {
    Write-Warning "Konnte nicht entfernen (Prozess nutzt Dateien noch?): $UnpackedPath"
    Write-Host "  $($_.Exception.Message)" -ForegroundColor DarkGray
    return $false
  }
}

function Clear-ReleaseWinUnpackedArtifacts([string] $RepoRoot, [string] $CurrentVersion) {
  $releaseRoot = Join-Path $RepoRoot 'release'
  if (-not (Test-Path -LiteralPath $releaseRoot)) {
    return
  }

  $failed = 0
  $currentUnpacked = Join-Path $releaseRoot "$CurrentVersion\win-unpacked"
  if (-not (Remove-WinUnpackedArtifact $currentUnpacked)) {
    $failed++
  }

  Get-ChildItem -Path $releaseRoot -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ne $CurrentVersion } |
    ForEach-Object {
      $unpacked = Join-Path $_.FullName 'win-unpacked'
      if (-not (Remove-WinUnpackedArtifact $unpacked)) {
        $failed++
      }
    }

  if ($failed -gt 0) {
    Write-Host ''
    Write-Warning @'
Einige alte Build-Ordner sind gesperrt (Chronell/Electron noch offen?).
Der Build laeuft trotzdem — release/** wird nicht ins Paket gepackt.
Gesperrte Ordner spaeter manuell loeschen, wenn nichts mehr laeuft.
'@
  }
}

function Find-SetupExe([string] $RepoRoot, [string] $Version) {
  $candidates = @(
    (Join-Path $RepoRoot "release\$Version\Chronell-$Version-setup.exe"),
    (Join-Path $RepoRoot "release\$Version\Chronell Setup $Version.exe")
  )
  foreach ($path in $candidates) {
    if (Test-Path -LiteralPath $path) {
      return (Resolve-Path -LiteralPath $path).Path
    }
  }
  $found = Get-ChildItem -Path (Join-Path $RepoRoot 'release') -Recurse -Filter 'Chronell-*-setup.exe' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if ($found) {
    return $found.FullName
  }
  return $null
}

# --- main ---
$repoRoot = Get-RepoRoot
Set-Location -LiteralPath $repoRoot

$packageJson = Join-Path $repoRoot 'package.json'

Write-Step 'Chronell - lokales Update-Build'
Write-Host "Projekt: $repoRoot" -ForegroundColor DarkGray

if (Test-ChronellRunning) {
  Write-Host ''
  Write-Warning 'Chronell oder Electron läuft noch. Bitte alle Fenster schließen (Dev + installierte App), sonst kann der Build fehlschlagen.'
  if (-not $Force -and -not $PSCmdlet.ShouldContinue('Trotzdem fortfahren?', 'Prozess aktiv')) {
    exit 1
  }
}

Write-Step 'Version vorbereiten'
$prepareParams = @{}
if ($PSBoundParameters.ContainsKey('Bump')) {
  $prepareParams.Bump = $Bump
}
if ($NoBump) {
  $prepareParams.NoBump = $true
}
if ($NoPrompt) {
  $prepareParams.NoPrompt = $true
}
Invoke-PrepareWinVersion @prepareParams
$version = Read-PackageVersion $packageJson

if (-not $SkipBuild) {
  Write-Step 'Aufräumen: alte win-unpacked Artefakte (optional, bei Sperre wird übersprungen)'
  Clear-ReleaseWinUnpackedArtifacts -RepoRoot $repoRoot -CurrentVersion $version

  Write-Step 'Build: npm run build:win:inner (kann einige Minuten dauern)'
  npm run build:win:inner
  if ($LASTEXITCODE -ne 0) {
    throw "build:win:inner fehlgeschlagen (Exit-Code $LASTEXITCODE)."
  }
} else {
  Write-Step 'Build übersprungen (-SkipBuild)'
}

$setupExe = Find-SetupExe $repoRoot $version
if (-not $setupExe) {
  throw ('Setup nicht gefunden unter release/{0}. Build pruefen.' -f $version)
}

Write-Step 'Fertig'
Write-Host "Version:  $version" -ForegroundColor Green
Write-Host "Setup:    $setupExe" -ForegroundColor Green
Write-Host ''
Write-Host 'Installation: Setup ausfuehren. Alte Version wird ersetzt. Daten bleiben in %APPDATA%\Chronell' -ForegroundColor DarkGray

if (-not $NoOpen) {
  $setupDir = Split-Path -Parent $setupExe
  Start-Process -FilePath 'explorer.exe' -ArgumentList @('/select,', $setupExe)
}

if ($RunInstaller) {
  Write-Step 'Starte Installer'
  Start-Process -FilePath $setupExe -Verb RunAs
}
