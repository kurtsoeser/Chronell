#Requires -Version 5.1
<#
.SYNOPSIS
  End-of-day Veröffentlichung: QA, Release-Notizen, Doku-Sync, Windows-Build, GitHub Release, vollständiger Git-Push.

.EXAMPLE
  npm run publish:day
  .\scripts\publish-day.ps1 -DryRun
  .\scripts\publish-day.ps1 -NotesFile docs/releases/0.9.24.md -NoPrompt
  .\scripts\publish-day.ps1 -LocalOnly -SkipChecks
#>
[CmdletBinding()]
param(
  [string] $NotesFile,
  [ValidateSet('patch', 'minor', 'major')]
  [string] $Bump = 'patch',
  [switch] $NoBump,
  [switch] $NoPrompt,
  [switch] $SkipChecks,
  [switch] $LocalOnly,
  [switch] $DryRun,

  # Notizen aus Git erzeugen (Standard). -ManualNotes = Notepad wie frueher.
  [switch] $ManualNotes,
  [switch] $ReviewNotes
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

function Write-Step([string] $Message) {
  Write-Host ''
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

function Read-PackageVersion([string] $PackageJsonPath) {
  $pkg = Get-Content -LiteralPath $PackageJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
  if (-not $pkg.version) { throw "Keine version in $PackageJsonPath." }
  return [string] $pkg.version
}

function Bump-SemVerPatch([string] $Version) {
  if ($Version -notmatch '^(\d+)\.(\d+)\.(\d+)$') {
    throw "Ungueltige Version: $Version"
  }
  $patch = [int] $Matches[3] + 1
  return ('{0}.{1}.{2}' -f $Matches[1], $Matches[2], $patch)
}

function Get-GermanDateLabel {
  $d = Get-Date
  $months = @(
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  )
  return ('{0} {1} {2}' -f $d.Day, $months[$d.Month - 1], $d.Year)
}

function Invoke-NpmStep {
  param(
    [Parameter(Mandatory)][string] $ScriptName,
    [string] $Label
  )
  if (-not $Label) { $Label = $ScriptName }
  Write-Step $Label
  if ($DryRun) {
    Write-Host "  [DryRun] npm run $ScriptName" -ForegroundColor Yellow
    return
  }
  & npm run $ScriptName
  if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
    throw "npm run $ScriptName fehlgeschlagen (Exit $LASTEXITCODE)."
  }
}

function Test-Preflight {
  param([string] $RepoRoot)

  Write-Step 'Preflight'
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'git nicht gefunden.'
  }

  $branchResult = git -C $RepoRoot rev-parse --abbrev-ref HEAD 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw 'Kein Git-Repository oder Branch nicht ermittelbar.'
  }
  Write-Host "  Branch: $branchResult" -ForegroundColor DarkGray

  if (-not $LocalOnly) {
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
      throw 'gh CLI nicht gefunden (https://cli.github.com/). Fuer -LocalOnly optional.'
    }
    $ghAuth = gh auth status 2>&1
    if ($LASTEXITCODE -ne 0) {
      throw "gh nicht angemeldet. Bitte: gh auth login`n$ghAuth"
    }
    Write-Host '  gh: angemeldet' -ForegroundColor DarkGray
  }

  if ($DryRun) {
    Write-Host '  [DryRun] ensure-git-lfs.ps1' -ForegroundColor Yellow
  } else {
    & (Join-Path $PSScriptRoot 'ensure-git-lfs.ps1') | Out-Null
  }

  $envCheck = git -C $RepoRoot ls-files --stage .env 2>&1
  if ($envCheck -and $envCheck.ToString().Trim()) {
    Write-Host '  WARNUNG: .env ist im Git-Index — vor dem Commit entfernen!' -ForegroundColor Red
    if (-not $DryRun) {
      throw '.env wuerde mit committed — Abbruch.'
    }
  }

  $status = git -C $RepoRoot status --porcelain 2>&1
  $lineCount = @($status | Where-Object { $_.ToString().Trim() }).Count
  Write-Host "  Working tree: $lineCount geaenderte Datei(en)" -ForegroundColor DarkGray
}

function Resolve-ReleaseNotesFile {
  param(
    [string] $RepoRoot,
    [string] $TargetVersion
  )

  $unreleased = Join-Path $RepoRoot 'docs\releases\UNRELEASED.md'

  if ($NotesFile) {
    if (-not (Test-Path -LiteralPath $NotesFile)) {
      throw "NotesFile nicht gefunden: $NotesFile"
    }
    return (Resolve-Path -LiteralPath $NotesFile).Path
  }

  if ($ManualNotes) {
    if (-not (Test-Path -LiteralPath $unreleased) -and -not $DryRun) {
      $templatePath = Join-Path $RepoRoot 'docs\releases\TEMPLATE.md'
      if (Test-Path -LiteralPath $templatePath) {
        Copy-Item -LiteralPath $templatePath -Destination $unreleased -Force
      }
    }
    if ($DryRun) {
      Write-Host "  [DryRun] Manuelle Notizen: $unreleased" -ForegroundColor Yellow
      return $unreleased
    }
    if (-not $NoPrompt) {
      Write-Host ''
      Write-Host "Release-Notizen (manuell): $unreleased" -ForegroundColor White
      Start-Process notepad.exe -ArgumentList $unreleased -Wait
      Read-Host 'Weiter mit Enter'
    }
    return $unreleased
  }

  Write-Host '  Aus Git-Aenderungen seit letztem Release-Tag ...' -ForegroundColor DarkGray
  $genArgs = @{ TargetVersion = $TargetVersion }
  if (-not $NoBump) {
    $genArgs['SinceTag'] = "v$((Read-PackageVersion (Join-Path $RepoRoot 'package.json')))"
  }
  if ($DryRun) { $genArgs['DryRun'] = $true }
  $genResult = & (Join-Path $PSScriptRoot 'generate-release-notes.ps1') @genArgs
  if (-not $?) {
    throw 'generate-release-notes.ps1 fehlgeschlagen.'
  }

  if ($ReviewNotes -and -not $DryRun -and -not $NoPrompt) {
    Write-Host ''
    Write-Host 'Kurz pruefen (optional anpassen), speichern, Enter ...' -ForegroundColor DarkGray
    Start-Process notepad.exe -ArgumentList $unreleased -Wait
    Read-Host 'Weiter mit Enter'
  }

  return $unreleased
}

# --- main ---
$repoRoot = Get-RepoRoot
Set-Location -LiteralPath $repoRoot

Write-Host ''
Write-Host 'Chronell Publish-Day' -ForegroundColor White
Write-Host '====================' -ForegroundColor DarkGray
if ($DryRun) { Write-Host 'Modus: DryRun (keine Aenderungen)' -ForegroundColor Yellow }
if ($LocalOnly) { Write-Host 'Modus: LocalOnly (kein Push/Upload)' -ForegroundColor Yellow }

Test-Preflight -RepoRoot $repoRoot

$packageJson = Join-Path $repoRoot 'package.json'
$currentVersion = Read-PackageVersion $packageJson
$plannedVersion = if ($NoBump) { $currentVersion } else { Bump-SemVerPatch $currentVersion }

if (-not $NotesFile) {
  Write-Step 'Release-Notizen'
  Write-Host "  Geplante Version: $plannedVersion (aktuell: $currentVersion)" -ForegroundColor DarkGray
  if (-not $ManualNotes) {
    Write-Host "  Automatisch aus Git (seit v$currentVersion + Working Tree)" -ForegroundColor DarkGray
  }
}

$notesPath = Resolve-ReleaseNotesFile -RepoRoot $repoRoot -TargetVersion $plannedVersion

$prepareArgs = @{
  Bump     = $Bump
  NoPrompt = $NoPrompt
}
if ($NoBump) { $prepareArgs['NoBump'] = $true }

Write-Step 'Version synchronisieren'
if ($DryRun) {
  Write-Host "  [DryRun] prepare-win-version.ps1 -Bump $Bump" -ForegroundColor Yellow
} else {
  & (Join-Path $PSScriptRoot 'prepare-win-version.ps1') @prepareArgs
  if (-not $?) { throw 'prepare-win-version.ps1 fehlgeschlagen.' }
}

$version = Read-PackageVersion $packageJson

Write-Step 'Dokumentation aus Release-Notizen'
$syncArgs = @{ NotesFile = $notesPath }
if ($DryRun) { $syncArgs['DryRun'] = $true }
$releaseInfo = & (Join-Path $PSScriptRoot 'sync-release-docs.ps1') @syncArgs
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($releaseInfo.Version -ne $version) {
  Write-Host "  Hinweis: Notizen-Version $($releaseInfo.Version) != package.json $version" -ForegroundColor Yellow
}

if (-not $SkipChecks) {
  Invoke-NpmStep -ScriptName 'typecheck' -Label 'Typecheck'
  Invoke-NpmStep -ScriptName 'test' -Label 'Tests'
} else {
  Write-Host 'Qualitaetschecks uebersprungen (-SkipChecks).' -ForegroundColor DarkGray
}

if ($LocalOnly) {
  $env:CHRONELL_SKIP_PUBLISH = '1'
}

Write-Step "Windows-Build v$version"
if ($DryRun) {
  Write-Host '  [DryRun] npm run build:win:inner' -ForegroundColor Yellow
} else {
  $env:CHRONELL_SKIP_VERSION_PREPARE = '1'
  try {
    & npm run build:win:inner
    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  } finally {
    Remove-Item Env:CHRONELL_SKIP_VERSION_PREPARE -ErrorAction SilentlyContinue
  }
}

if (-not $LocalOnly) {
  Write-Step 'Veroeffentlichen (Installer, Homepage, Git, GitHub Release)'
  if ($DryRun) {
    Write-Host '  [DryRun] publish-docs-release.ps1 -PushGit -IncludeAll' -ForegroundColor Yellow
  } else {
    $env:CHRONELL_AUTO_RELEASE = '1'
    $ghNotes = Join-Path $repoRoot 'docs\releases\latest-gh-notes.md'
    $publishArgs = @{
      Version    = $version
      NoOpen     = $true
      PushGit    = $true
      IncludeAll = $true
    }
    if (Test-Path -LiteralPath $ghNotes) {
      $publishArgs['ReleaseNotesFile'] = $ghNotes
    }
    $firstBullet = ($releaseInfo.BulletsDe | Select-Object -First 1) -replace '^\-\s+', ''
    if ($firstBullet) {
      $publishArgs['CommitSubject'] = $firstBullet
    }
    & (Join-Path $PSScriptRoot 'publish-docs-release.ps1') @publishArgs
    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
} else {
  Write-Step 'Lokaler Build abgeschlossen'
  $setupPath = Join-Path $repoRoot "release\$version\Chronell-$version-setup.exe"
  if (Test-Path -LiteralPath $setupPath) {
    Write-Host "  Installer: $setupPath" -ForegroundColor Green
  }
  Write-Host 'Veroeffentlichung uebersprungen (-LocalOnly).' -ForegroundColor DarkGray
}

Write-Host ''
Write-Host 'Publish-Day abgeschlossen.' -ForegroundColor Green
if (-not $LocalOnly -and -not $DryRun) {
  Write-Host "  Version:   $version" -ForegroundColor Green
  Write-Host "  Download:  https://github.com/kurtsoeser/Chronell/releases/download/v$version/Chronell-$version-setup.exe" -ForegroundColor Green
  Write-Host '  Homepage:  https://chronell.app/ (1-3 Min.)' -ForegroundColor Green
  Write-Host ''
  Write-Host 'Optional pruefen:' -ForegroundColor DarkGray
  Write-Host '  cd docs && npx --yes serve .' -ForegroundColor DarkGray
  Write-Host '  npm run generate:homepage-screenshots' -ForegroundColor DarkGray
}
