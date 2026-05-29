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
  [string] $Version,

  [switch] $IncludeAll,

  [string] $CommitSubject
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'release-git-helpers.ps1')

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $repoRoot

if ($env:CHRONELL_SKIP_GIT_PUSH -eq '1') {
  Write-Host 'Git-Push uebersprungen (CHRONELL_SKIP_GIT_PUSH=1).' -ForegroundColor DarkGray
  exit 0
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host 'git nicht gefunden - Push uebersprungen.' -ForegroundColor Yellow
  exit 0
}

& (Join-Path $PSScriptRoot 'ensure-git-lfs.ps1') | Out-Null

$branchResult = Invoke-GitCli -GitArgs @('rev-parse', '--abbrev-ref', 'HEAD')
$branch = ($branchResult.Output | Select-Object -First 1).ToString().Trim()
if ($branchResult.ExitCode -ne 0 -or -not $branch) {
  Write-Host 'Kein Git-Branch - Push uebersprungen.' -ForegroundColor Yellow
  exit 0
}

if ($IncludeAll) {
  $addResult = Invoke-GitCli -GitArgs @('add', '-A')
} else {
  $addResult = Invoke-GitCli -GitArgs @(
    'add', '.gitattributes', 'docs/release', 'package.json', 'src/shared/app-version.ts', 'docs/index.html',
    'docs/FUNKTIONSPROTOKOLL.md', 'docs/i18n', 'docs/releases'
  )
}
if ($addResult.ExitCode -ne 0) {
  Write-CliFailure -Result $addResult -Context 'git add fehlgeschlagen.'
  exit $addResult.ExitCode
}

$statusResult = Invoke-GitCli -GitArgs @('status', '--porcelain')
$porcelain = ($statusResult.Output | Out-String).Trim()
if (-not $porcelain) {
  Write-Host 'Keine Aenderungen zum Pushen - bereits aktuell.' -ForegroundColor DarkGray
} else {
  if ($CommitSubject) {
    $subject = $CommitSubject.Trim()
    if ($subject.Length -gt 72) { $subject = $subject.Substring(0, 69) + '...' }
    $msg = ('Release {0}: {1}' -f $Version, $subject)
  } else {
    $msg = ('Release {0}: Installer, Manifeste und Homepage' -f $Version)
  }
  $commitResult = Invoke-GitCli -GitArgs @('commit', '-m', $msg)
  if ($commitResult.ExitCode -ne 0) {
    Write-CliFailure -Result $commitResult -Context 'git commit fehlgeschlagen.'
    exit $commitResult.ExitCode
  }

  Write-Host ''
  Write-Host "Pushe nach origin/$branch (inkl. Git LFS) ..." -ForegroundColor Cyan
  $pushResult = Invoke-GitCli -GitArgs @('push', 'origin', $branch)
  if ($pushResult.ExitCode -ne 0) {
    Write-CliFailure -Result $pushResult -Context 'git push fehlgeschlagen — pruefe Netzwerk und gh/git-Anmeldung.'
    exit $pushResult.ExitCode
  }
}

$tag = "v$Version"
$tagMsg = "Release $Version"
$tagVerify = Invoke-GitCli -GitArgs @('rev-parse', '-q', '--verify', "refs/tags/$tag")
if ($tagVerify.ExitCode -ne 0) {
  $tagCreate = Invoke-GitCli -GitArgs @('tag', '-a', $tag, '-m', $tagMsg)
} else {
  $tagCreate = Invoke-GitCli -GitArgs @('tag', '-f', '-a', $tag, '-m', $tagMsg)
}
if ($tagCreate.ExitCode -ne 0) {
  Write-CliFailure -Result $tagCreate -Context "git tag $tag fehlgeschlagen."
  exit $tagCreate.ExitCode
}

$tagPush = Invoke-GitCli -GitArgs @('push', 'origin', $tag, '--force')
if ($tagPush.ExitCode -ne 0) {
  Write-CliFailure -Result $tagPush -Context "git push Tag $tag fehlgeschlagen."
  exit $tagPush.ExitCode
}

Write-Host "Git-Tag $tag auf HEAD gesetzt und gepusht." -ForegroundColor DarkGray
Write-Host 'GitHub Pages aktualisiert sich in 1-3 Minuten.' -ForegroundColor Green
Write-Host 'Download (sofort): GitHub Releases' -ForegroundColor Green
