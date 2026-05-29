#Requires -Version 5.1
<#
.SYNOPSIS
  Versionsabfrage und -sync vor einem Windows-Build (package.json + app-version.ts).

.DESCRIPTION
  Wird automatisch vor npm run build:win ausgefuehrt (npm prebuild:win Hook).
  Fragt interaktiv: neue Patch-Version oder gleiche Version neu bauen.
  Nach dem Build (postbuild-win.ps1): automatische Veröffentlichung auf GitHub (Release + git push).

.EXAMPLE
  .\scripts\prepare-win-version.ps1

.EXAMPLE
  .\scripts\prepare-win-version.ps1 -NoBump
  Gleiche Version, keine Rückfrage.

.EXAMPLE
  .\scripts\prepare-win-version.ps1 -NoPrompt
  Patch erhöhen ohne Rückfrage (CI / Automatisierung).
#>
[CmdletBinding()]
param(
  [ValidateSet('patch', 'minor', 'major')]
  [string] $Bump = 'patch',

  [switch] $NoBump,

  [switch] $NoPrompt
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
  if ($raw -match '"version"\s*:\s*"([0-9]+\.[0-9]+\.[0-9]+)"' -and $Matches[1] -eq $NewVersion) {
    Write-Host '  package.json: Version bereits aktuell.' -ForegroundColor DarkGray
    return
  }
  $updated = $raw -replace '("version"\s*:\s*")[^"]+(")', "`${1}$NewVersion`${2}"
  if ($updated -eq $raw) {
    throw "version in package.json konnte nicht aktualisiert werden."
  }
  [System.IO.File]::WriteAllText($PackageJsonPath, $updated, [System.Text.UTF8Encoding]::new($false))
}

function Set-AppVersionTs([string] $AppVersionPath, [string] $NewVersion, [string] $ReleaseDateIso) {
  $raw = Get-Content -LiteralPath $AppVersionPath -Raw -Encoding UTF8
  $versionOk = $raw -match "export const APP_VERSION = '$([regex]::Escape($NewVersion))'"
  $dateOk = $raw -match "export const APP_RELEASE_DATE_ISO = '$([regex]::Escape($ReleaseDateIso))'"
  if ($versionOk -and $dateOk) {
    Write-Host '  app-version.ts: bereits aktuell.' -ForegroundColor DarkGray
    return
  }
  $updated = $raw -replace "export const APP_VERSION = '[^']+'", "export const APP_VERSION = '$NewVersion'"
  $updated = $updated -replace "export const APP_RELEASE_DATE_ISO = '[^']+'", "export const APP_RELEASE_DATE_ISO = '$ReleaseDateIso'"
  if ($updated -eq $raw) {
    throw "app-version.ts konnte nicht aktualisiert werden (unerwartetes Dateiformat)."
  }
  [System.IO.File]::WriteAllText($AppVersionPath, $updated, [System.Text.UTF8Encoding]::new($false))
}

function Test-InteractivePrompt {
  if ($env:CI -eq 'true' -or $env:CI -eq '1') {
    return $false
  }
  if ($env:CHRONELL_NO_VERSION_PROMPT -eq '1') {
    return $false
  }
  return [Environment]::UserInteractive
}

function Read-VersionBumpChoice {
  param(
    [string] $CurrentVersion,
    [string] $NextVersion,
    [string] $BumpLabel
  )

  Write-Host ''
  Write-Host "Aktuelle Version: $CurrentVersion" -ForegroundColor White
  Write-Host ''
  Write-Host "  [J] Neue Versionsnummer ($BumpLabel)" -ForegroundColor Green
  Write-Host "      -> $NextVersion" -ForegroundColor DarkGray
  Write-Host '  [N] Gleiche Version neu bauen (Setup überschreiben)' -ForegroundColor Yellow
  Write-Host "      -> $CurrentVersion" -ForegroundColor DarkGray
  Write-Host ''

  while ($true) {
    $raw = Read-Host 'Auswahl [J/n]'
    if ($null -eq $raw) {
      Write-Host 'Keine Eingabe möglich (nicht-interaktiv): gleiche Version wird neu gebaut.' -ForegroundColor DarkGray
      return $false
    }
    $answer = $raw.Trim()
    if ($answer -eq '' -or $answer -match '^(j|ja|y|yes)$') {
      return $true
    }
    if ($answer -match '^(n|nein|no)$') {
      return $false
    }
    Write-Host 'Bitte J (neue Version) oder N (überschreiben) eingeben.' -ForegroundColor Yellow
  }
}

# --- main ---
if ($env:CHRONELL_SKIP_VERSION_PREPARE -eq '1') {
  exit 0
}

$repoRoot = Get-RepoRoot
Set-Location -LiteralPath $repoRoot

$packageJson = Join-Path $repoRoot 'package.json'
$appVersionTs = Join-Path $repoRoot 'src\shared\app-version.ts'

$version = Read-PackageVersion $packageJson
$releaseDate = Get-Date -Format 'yyyy-MM-dd'

$bumpKind = if ($PSBoundParameters.ContainsKey('Bump')) { $Bump } else { 'patch' }
$wantBump = -not $NoBump

if ($NoBump) {
  $wantBump = $false
} elseif ($NoPrompt -or -not (Test-InteractivePrompt)) {
  if (-not $NoPrompt -and -not (Test-InteractivePrompt)) {
    Write-Host 'Nicht-interaktive Umgebung: Patch-Version wird erhöht (-NoPrompt-Verhalten).' -ForegroundColor DarkGray
  }
  $wantBump = $true
} else {
  $nextVersion = Bump-SemVerString $version $bumpKind
  $bumpLabel = switch ($bumpKind) {
    'major' { 'Major' }
    'minor' { 'Minor' }
    default { 'Patch' }
  }
  $wantBump = Read-VersionBumpChoice -CurrentVersion $version -NextVersion $nextVersion -BumpLabel $bumpLabel
}

if ($wantBump) {
  $newVersion = Bump-SemVerString $version $bumpKind
  Write-Step "Version: $version -> $newVersion ($bumpKind)"
  Set-PackageVersion $packageJson $newVersion
  Set-AppVersionTs $appVersionTs $newVersion $releaseDate
} else {
  Write-Step "Version unverändert: $version (wird überschrieben neu gebaut)"
  Set-AppVersionTs $appVersionTs $version $releaseDate
}
