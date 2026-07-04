#Requires -Version 5.1
<#
.SYNOPSIS
  Kopiert den Windows-Installer nach docs/release/ (Git LFS) und GitHub Releases (Homepage-Download).

.EXAMPLE
  .\scripts\publish-docs-release.ps1
  .\scripts\publish-docs-release.ps1 -Version 0.9.8 -NoOpen
  .\scripts\publish-docs-release.ps1 -IndexOnly
#>
[CmdletBinding()]
param(
  [string] $Version,
  [switch] $NoOpen,
  [switch] $IndexOnly,
  [switch] $SkipGitHubRelease,
  [switch] $PushGit,
  [switch] $IncludeAll,
  [string] $ReleaseNotes,
  [string] $ReleaseNotesFile,
  [string] $CommitSubject
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {
  # ignore on hosts without console
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $repoRoot
. (Join-Path $PSScriptRoot 'release-git-helpers.ps1')

$autoRelease = $env:CHRONELL_AUTO_RELEASE -eq '1' -or $PushGit
if ($autoRelease) {
  & (Join-Path $PSScriptRoot 'ensure-git-lfs.ps1') | Out-Null
}

function Read-PackageVersion {
  $pkg = Get-Content -LiteralPath (Join-Path $repoRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  return [string] $pkg.version
}

function Find-SetupExe([string] $Ver) {
  $candidates = @(
    (Join-Path $repoRoot "release\$Ver\Chronell-$Ver-setup.exe"),
    (Join-Path $repoRoot "release\$Ver\Chronell Setup $Ver.exe")
  )
  foreach ($path in $candidates) {
    if (Test-Path -LiteralPath $path) { return (Resolve-Path -LiteralPath $path).Path }
  }
  $found = Get-ChildItem -Path (Join-Path $repoRoot 'release') -Recurse -Filter 'Chronell-*-setup.exe' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if ($found) { return $found.FullName }
  return $null
}

$docsRelease = Join-Path $repoRoot 'docs\release'
$latestDir = Join-Path $docsRelease 'latest'
$stableName = 'Chronell-setup.exe'

function Get-DocsReleaseVersions {
  $dirs = Get-ChildItem -LiteralPath $docsRelease -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' }
  return $dirs | Sort-Object { [version]$_.Name } -Descending
}

function Get-ReleaseNotesText {
  param(
    [string] $Notes,
    [string] $NotesFile,
    [string] $Version
  )

  if ($NotesFile -and (Test-Path -LiteralPath $NotesFile)) {
    return (Get-Content -LiteralPath $NotesFile -Raw -Encoding UTF8).Trim()
  }
  if ($Notes) {
    return $Notes.Trim()
  }
  return "Windows-11-Beta-Installer fuer Chronell $Version."
}

function Publish-GitHubReleaseAsset {
  param(
    [string] $Version,
    [string] $SetupPath,
    [string] $VersionedAssetName,
    [string] $ReleaseNotes,
    [string] $ReleaseNotesFile,
    [switch] $Strict
  )

  $ghTag = "v$Version"
  $ghRepo = 'kurtsoeser/Chronell'
  $ghDownloadUrl = "https://github.com/kurtsoeser/Chronell/releases/download/$ghTag/$VersionedAssetName"

  if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host '  gh CLI nicht gefunden - GitHub Release uebersprungen.' -ForegroundColor Yellow
    Write-Host '  Installation: https://cli.github.com/' -ForegroundColor DarkGray
    if ($Strict) { exit 1 }
    return
  }

  Write-Host ''
  Write-Host 'GitHub Release (primaerer Homepage-Download):' -ForegroundColor Cyan

  $headResult = Invoke-GitCli -GitArgs @('rev-parse', 'HEAD')
  $headSha = ($headResult.Output | Select-Object -First 1).ToString().Trim()
  if ($headResult.ExitCode -ne 0 -or -not $headSha) {
    Write-Host '  git rev-parse HEAD fehlgeschlagen - kein Release moeglich.' -ForegroundColor Yellow
    if ($Strict) { exit 1 }
    return
  }

  $releaseTitle = "Chronell $Version"
  $releaseNotesText = Get-ReleaseNotesText -Notes $ReleaseNotes -NotesFile $ReleaseNotesFile -Version $Version
  $notesFileTemp = $null
  if ($releaseNotesText.Length -gt 200) {
    $notesFileTemp = [System.IO.Path]::GetTempFileName() + '.md'
    [System.IO.File]::WriteAllText($notesFileTemp, $releaseNotesText, [System.Text.UTF8Encoding]::new($false))
  }

  $viewResult = Invoke-GhCli -GhArgs @('release', 'view', $ghTag, '--repo', $ghRepo)
  $uploaded = $false

  if ($viewResult.ExitCode -eq 0) {
    Write-Host "  Release $ghTag existiert - lade Installer hoch ..." -ForegroundColor DarkGray
  } else {
    $shortSha = $headSha.Substring(0, 7)
    Write-Host "  Erstelle Release $ghTag (Commit $shortSha) ..." -ForegroundColor DarkGray
    $createArgs = @(
      'release', 'create', $ghTag, $SetupPath,
      '--title', $releaseTitle,
      '--repo', $ghRepo,
      '--target', $headSha
    )
    if ($notesFileTemp) {
      $createArgs += @('--notes-file', $notesFileTemp)
    } else {
      $createArgs += @('--notes', $releaseNotesText)
    }
    $createResult = Invoke-GhCli -GhArgs $createArgs
    if ($createResult.ExitCode -eq 0) {
      Write-Host '  Release angelegt und Installer hochgeladen.' -ForegroundColor Green
      $uploaded = $true
    } else {
      Write-CliFailure -Result $createResult -Context 'gh release create fehlgeschlagen.'
      $viewRetry = Invoke-GhCli -GhArgs @('release', 'view', $ghTag, '--repo', $ghRepo)
      if ($viewRetry.ExitCode -ne 0) {
        if ($Strict) { exit 1 }
        return
      }
      Write-Host "  Release $ghTag vorhanden - versuche Upload erneut ..." -ForegroundColor DarkGray
    }
  }

  if (-not $uploaded) {
    $uploadResult = Invoke-GhCli -GhArgs @(
      'release', 'upload', $ghTag, $SetupPath,
      '--clobber',
      '--repo', $ghRepo
    )
    if ($uploadResult.ExitCode -eq 0) {
      $uploaded = $true
    } else {
      Write-CliFailure -Result $uploadResult -Context 'gh release upload fehlgeschlagen - pruefe: gh auth login'
      if ($Strict) { exit 1 }
      return
    }
  }

  if ($uploaded) {
    Write-Host "  GitHub Releases: $ghDownloadUrl" -ForegroundColor Green
    Write-Host '  Homepage-Download verweist auf diese URL (site.js + latest.json).' -ForegroundColor DarkGray
  }

  if ($viewResult.ExitCode -eq 0 -or $uploaded) {
    $editArgs = @('release', 'edit', $ghTag, '--repo', $ghRepo, '--title', $releaseTitle)
    if ($notesFileTemp) {
      $editArgs += @('--notes-file', $notesFileTemp)
    } else {
      $editArgs += @('--notes', $releaseNotesText)
    }
    $editResult = Invoke-GhCli -GhArgs $editArgs
    if ($editResult.ExitCode -ne 0) {
      Write-CliFailure -Result $editResult -Context 'gh release edit (Notizen) fehlgeschlagen.'
    }
  }

  if ($notesFileTemp -and (Test-Path -LiteralPath $notesFileTemp)) {
    Remove-Item -LiteralPath $notesFileTemp -Force -ErrorAction SilentlyContinue
  }
}

if (-not $Version) {
  $sorted = Get-DocsReleaseVersions
  if ($sorted.Count -gt 0) {
    $Version = $sorted[0].Name
  } else {
    $Version = Read-PackageVersion
  }
}

if (-not $IndexOnly) {
  $setupExe = Find-SetupExe $Version
  if (-not $setupExe) {
    throw "Kein Setup gefunden. Zuerst: npm run build:win (Version $Version)"
  }

  $versionDir = Join-Path $docsRelease $Version
  $versionedName = "Chronell-$Version-setup.exe"

  New-Item -ItemType Directory -Force -Path $versionDir, $latestDir | Out-Null

  Copy-Item -LiteralPath $setupExe -Destination (Join-Path $versionDir $versionedName) -Force
  Copy-Item -LiteralPath $setupExe -Destination (Join-Path $latestDir $stableName) -Force

  $setupMb = [math]::Round((Get-Item -LiteralPath $setupExe).Length / 1MB, 2)
  if ($setupMb -gt 98) {
    Write-Host ''
    Write-Host "  Hinweis: Installer ist ${setupMb} MB - wird per Git LFS ins Repo gepusht (max. 100 MB ohne LFS)." -ForegroundColor DarkGray
    Write-Host '  Homepage-Download: GitHub Releases (scripts/setup-git-lfs.ps1 falls noch nicht aktiv).' -ForegroundColor DarkGray
  }
} elseif (-not (Test-Path -LiteralPath (Join-Path $latestDir $stableName))) {
  $versionedName = "Chronell-$Version-setup.exe"
  $fromVersioned = Join-Path $docsRelease "$Version\$versionedName"
  if (Test-Path -LiteralPath $fromVersioned) {
    New-Item -ItemType Directory -Force -Path $latestDir | Out-Null
    Copy-Item -LiteralPath $fromVersioned -Destination (Join-Path $latestDir $stableName) -Force
  }
}

$appVersionTs = Join-Path $repoRoot 'src\shared\app-version.ts'
$releasedAt = (Get-Date -Format 'yyyy-MM-dd')
if (Test-Path -LiteralPath $appVersionTs) {
  $raw = Get-Content -LiteralPath $appVersionTs -Raw -Encoding UTF8
  if ($raw -match 'APP_RELEASE_DATE_ISO = ''(.+)''') {
    $releasedAt = $Matches[1]
  }
}

$versionedName = "Chronell-$Version-setup.exe"
$ghTag = "v$Version"
$ghDownloadUrl = "https://github.com/kurtsoeser/Chronell/releases/download/$ghTag/$versionedName"
$demoPortableName = "Chronell-$Version-Demo-Portable.zip"
$demoPortablePath = Join-Path $versionDir $demoPortableName
$ghDemoPortableUrl = "https://github.com/kurtsoeser/Chronell/releases/download/$ghTag/$demoPortableName"

$pagesStableUrl = 'release/latest/Chronell-setup.exe'
$pagesVersionedUrl = "release/$Version/$versionedName"

$isBetaRelease = $true
if ($Version -match '^(\d+)\.') {
  $isBetaRelease = [int] $Matches[1] -lt 1
}

$manifest = [ordered]@{
  version           = $Version
  releasedAt        = $releasedAt
  beta              = $isBetaRelease
  filename          = $stableName
  downloadUrl       = $ghDownloadUrl
  stableUrl         = $pagesStableUrl
  versionedUrl      = $pagesVersionedUrl
  githubDownloadUrl = $ghDownloadUrl
}
if (Test-Path -LiteralPath $demoPortablePath) {
  $manifest['demoPortableDownloadUrl'] = $ghDemoPortableUrl
}
$manifestPath = Join-Path $docsRelease 'latest.json'
$manifest | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding UTF8

$versionRows = @()
foreach ($dir in Get-DocsReleaseVersions) {
  $ver = $dir.Name
  $exeName = "Chronell-$ver-setup.exe"
  $exePath = Join-Path $dir.FullName $exeName
  if (-not (Test-Path -LiteralPath $exePath)) { continue }
  $ghVerUrl = "https://github.com/kurtsoeser/Chronell/releases/download/v$ver/$exeName"
  $versionRows += [ordered]@{
    version           = $ver
    setupUrl          = "release/$ver/$exeName"
    downloadUrl       = $ghVerUrl
    githubDownloadUrl = $ghVerUrl
  }
}

$versionsManifest = [ordered]@{
  latest            = $Version
  beta              = $isBetaRelease
  downloadUrl       = $ghDownloadUrl
  stableUrl         = $pagesStableUrl
  githubDownloadUrl = $ghDownloadUrl
  versions          = @($versionRows)
}
$versionsPath = Join-Path $docsRelease 'versions.json'
$versionsManifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $versionsPath -Encoding UTF8

Write-Host ''
Write-Host 'Installer fuer Homepage bereit:' -ForegroundColor Green
Write-Host "  Version:  $Version"
Write-Host "  Stabil:   docs/release/latest/$stableName"
Write-Host "  Archiv:   docs/release/$Version/$versionedName"
Write-Host "  Manifest: docs/release/latest.json"
Write-Host "  Index:    docs/release/versions.json"
if (-not $IndexOnly) {
  & (Join-Path $PSScriptRoot 'sync-homepage-download-urls.ps1') -Version $Version
}

if (-not $autoRelease) {
  Write-Host ''
  Write-Host 'Als Naechstes: npm run publish:docs-release -PushGit  oder erneut npm run build:win' -ForegroundColor DarkGray
  Write-Host "  Oeffentlicher Download: $ghDownloadUrl" -ForegroundColor DarkGray
}

$setupForRelease = $null
if (-not $IndexOnly) {
  $setupForRelease = Join-Path $versionDir $versionedName
  if (-not (Test-Path -LiteralPath $setupForRelease)) {
    $setupForRelease = Join-Path $latestDir $stableName
  }
  if (-not (Test-Path -LiteralPath $setupForRelease)) {
    $setupForRelease = $null
  }
}

if ($autoRelease) {
  $pushArgs = @{ Version = $Version }
  if ($IncludeAll) { $pushArgs['IncludeAll'] = $true }
  if ($CommitSubject) { $pushArgs['CommitSubject'] = $CommitSubject }
  & (Join-Path $PSScriptRoot 'push-release-to-github.ps1') @pushArgs
  if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} elseif (-not $NoOpen) {
  Start-Process -FilePath 'explorer.exe' -ArgumentList @($docsRelease)
}

if (-not $IndexOnly -and -not $SkipGitHubRelease -and $setupForRelease) {
  Publish-GitHubReleaseAsset -Version $Version -SetupPath $setupForRelease -VersionedAssetName $versionedName `
    -ReleaseNotes $ReleaseNotes -ReleaseNotesFile $ReleaseNotesFile -Strict:$autoRelease
}
