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
  Patch-Version erhöhen, bauen, Explorer mit Setup öffnen.

.EXAMPLE
  .\scripts\update-local.ps1 -NoBump
  Gleiche Version neu bauen (z. B. nach weiteren Fixes).

.EXAMPLE
  .\scripts\update-local.ps1 -Bump minor -RunInstaller
  Minor-Version, bauen, Setup direkt starten.
#>
[CmdletBinding()]
param(
  [ValidateSet('patch', 'minor', 'major')]
  [string] $Bump = 'patch',

  [switch] $NoBump,

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

function Parse-SemVer([string] $Version) {
  if ($Version -notmatch '^(\d+)\.(\d+)\.(\d+)$') {
    throw "Ungültige Version '$Version' (erwartet: major.minor.patch)."
  }
  return [pscustomobject]@{
    Major = [int] $Matches[1]
    Minor = [int] $Matches[2]
    Patch = [int] $Matches[3]
  }
}

function Bump-SemVerString([string] $Version, [string] $Part) {
  $v = Parse-SemVer $Version
  switch ($Part) {
    'major' {
      $v.Major++
      $v.Minor = 0
      $v.Patch = 0
    }
    'minor' {
      $v.Minor++
      $v.Patch = 0
    }
    'patch' {
      $v.Patch++
    }
    default { throw "Unbekannter Bump-Typ: $Part" }
  }
  return "$($v.Major).$($v.Minor).$($v.Patch)"
}

function Set-PackageVersion([string] $PackageJsonPath, [string] $NewVersion) {
  $raw = Get-Content -LiteralPath $PackageJsonPath -Raw -Encoding UTF8
  $updated = $raw -replace '("version"\s*:\s*")[^"]+(")', "`${1}$NewVersion`${2}"
  if ($updated -eq $raw) {
    throw "version in package.json konnte nicht aktualisiert werden."
  }
  [System.IO.File]::WriteAllText($PackageJsonPath, $updated, [System.Text.UTF8Encoding]::new($false))
}

function Set-AppVersionTs([string] $AppVersionPath, [string] $NewVersion, [string] $ReleaseDateIso) {
  $raw = Get-Content -LiteralPath $AppVersionPath -Raw -Encoding UTF8
  $updated = $raw -replace "export const APP_VERSION = '[^']+'", "export const APP_VERSION = '$NewVersion'"
  $updated = $updated -replace "export const APP_RELEASE_DATE_ISO = '[^']+'", "export const APP_RELEASE_DATE_ISO = '$ReleaseDateIso'"
  if ($updated -eq $raw) {
    throw "app-version.ts konnte nicht aktualisiert werden."
  }
  [System.IO.File]::WriteAllText($AppVersionPath, $updated, [System.Text.UTF8Encoding]::new($false))
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
$appVersionTs = Join-Path $repoRoot 'src\shared\app-version.ts'

Write-Step 'Chronell - lokales Update-Build'
Write-Host "Projekt: $repoRoot" -ForegroundColor DarkGray

if (Test-ChronellRunning) {
  Write-Host ''
  Write-Warning 'Chronell oder Electron läuft noch. Bitte alle Fenster schließen (Dev + installierte App), sonst kann der Build fehlschlagen.'
  if (-not $Force -and -not $PSCmdlet.ShouldContinue('Trotzdem fortfahren?', 'Prozess aktiv')) {
    exit 1
  }
}

$version = Read-PackageVersion $packageJson
$releaseDate = Get-Date -Format 'yyyy-MM-dd'

if (-not $NoBump) {
  $newVersion = Bump-SemVerString $version $Bump
  Write-Step "Version: $version -> $newVersion ($Bump)"
  Set-PackageVersion $packageJson $newVersion
  Set-AppVersionTs $appVersionTs $newVersion $releaseDate
  $version = $newVersion
} else {
  Write-Step "Version unverändert: $version (-NoBump)"
  Set-AppVersionTs $appVersionTs $version $releaseDate
}

if (-not $SkipBuild) {
  Write-Step 'Build: npm run build:win (kann einige Minuten dauern)'
  npm run build:win
  if ($LASTEXITCODE -ne 0) {
    throw "build:win fehlgeschlagen (Exit-Code $LASTEXITCODE)."
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
