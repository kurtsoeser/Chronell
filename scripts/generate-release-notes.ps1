#Requires -Version 5.1
<#
.SYNOPSIS
  Erzeugt docs/releases/UNRELEASED.md aus Git-Aenderungen seit dem letzten Release-Tag.

.PARAMETER TargetVersion
  Zielversion fuer die Ueberschrift (z. B. 0.9.25).

.PARAMETER SinceTag
  Basis-Tag (Standard: v{aktuelle package.json-Version}).

.PARAMETER OutputFile
  Zielpfad (Standard: docs/releases/UNRELEASED.md).

.EXAMPLE
  .\scripts\generate-release-notes.ps1 -TargetVersion 0.9.25
#>
[CmdletBinding()]
param(
  [string] $TargetVersion,
  [string] $SinceTag,
  [string] $OutputFile,
  [switch] $DryRun
)

$ErrorActionPreference = 'Stop'

function Get-CollectionCount($Value) {
  if ($null -eq $Value) { return 0 }
  return @($Value).Count
}

function Invoke-GitLines {
  param([string] $RepoRoot, [string[]] $GitArgs)

  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = git -C $RepoRoot @GitArgs 2>&1
  $ErrorActionPreference = $prev
  if ($LASTEXITCODE -ne 0) { return @() }
  return @(@($output) | ForEach-Object { $_.ToString() } | Where-Object { $_.Length -gt 0 })
}

function Get-GermanDateLabel {
  $d = Get-Date
  $months = @(
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  )
  return ('{0}. {1} {2}' -f $d.Day, $months[$d.Month - 1], $d.Year)
}

function Resolve-ReleaseSinceTag {
  param(
    [string] $RepoRoot,
    [string] $TargetVersion
  )

  $targetTag = "v$TargetVersion"
  $tags = Invoke-GitLines $RepoRoot @('tag', '-l', 'v*', '--sort=-v:refname')
  foreach ($line in $tags) {
    $tag = $line.Trim()
    if (-not $tag -or $tag -eq $targetTag) { continue }
    $verify = Invoke-GitLines $RepoRoot @('rev-parse', '-q', '--verify', "${tag}^{commit}")
    if ((Get-CollectionCount $verify) -gt 0) {
      return $tag
    }
  }

  $desc = Invoke-GitLines $RepoRoot @('describe', '--tags', '--abbrev=0')
  if ((Get-CollectionCount $desc) -gt 0) {
    $d = $desc[0].Trim()
    if ($d -and $d -ne $targetTag) { return $d }
  }

  if ($TargetVersion -match '^(\d+)\.(\d+)\.(\d+)$') {
    $patch = [int] $Matches[3] - 1
    if ($patch -ge 0) {
      return ('v{0}.{1}.{2}' -f $Matches[1], $Matches[2], $patch)
    }
  }

  return $null
}

function Get-ChangedPaths {
  param(
    [string] $RepoRoot,
    [string] $Ref
  )

  $paths = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)

  function Add-Lines([string[]] $Lines) {
    foreach ($line in $Lines) {
      $p = ($line -replace '\\', '/').Trim()
      if ($p) { [void] $paths.Add($p) }
    }
  }

  $since = $Ref
  if ($since) {
    $verify = Invoke-GitLines $RepoRoot @('rev-parse', '-q', '--verify', "${since}^{commit}")
    if ((Get-CollectionCount $verify) -gt 0) {
      Add-Lines @(Invoke-GitLines $RepoRoot @('diff', '--name-only', "${since}..HEAD"))
    }
  }

  Add-Lines @(Invoke-GitLines $RepoRoot @('diff', '--name-only', 'HEAD'))
  Add-Lines @(Invoke-GitLines $RepoRoot @('diff', '--name-only', '--cached'))
  Add-Lines @(Invoke-GitLines $RepoRoot @('ls-files', '--others', '--exclude-standard'))

  return @($paths | Sort-Object)
}

function Get-CommitSubjects {
  param(
    [string] $RepoRoot,
    [string] $Ref
  )

  if (-not $Ref) { return @() }
  $verify = Invoke-GitLines $RepoRoot @('rev-parse', '-q', '--verify', "${Ref}^{commit}")
  if ((Get-CollectionCount $verify) -eq 0) { return @() }

  $lines = Invoke-GitLines $RepoRoot @('log', "${Ref}..HEAD", '--pretty=format:%s')
  return @(
    $lines |
      ForEach-Object { $_.Trim() } |
      Where-Object {
        $_ -and
        $_ -notmatch '^Release\s+[0-9]' -and
        $_ -notmatch '^Merge\b' -and
        $_ -notmatch 'Installer.*Manifeste'
      } |
      Select-Object -Unique
  )
}

function Test-PathMatches([string] $Path, [string[]] $Patterns) {
  foreach ($pat in $Patterns) {
    if ($Path -match $pat) { return $true }
  }
  return $false
}

function Get-FileHints([string[]] $Paths) {
  $hints = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  $rules = @(
    @{ Pat = 'CalendarEventDialog'; De = 'ueberarbeiteter Termin-Dialog' }
    @{ Pat = 'CalendarEventPreview'; De = 'Termin-Vorschau' }
    @{ Pat = 'CalendarEventRecurrence'; De = 'Serien und Wiederholungen' }
    @{ Pat = 'CalendarEventCategory'; De = 'Termin-Kategorien' }
    @{ Pat = 'CalendarEventDialogDayPicker'; De = 'Datumsauswahl im Termin-Dialog' }
    @{ Pat = 'mail-attachment-index'; De = 'Anhaenge-Index und -Sync' }
    @{ Pat = 'attachments-repo|mail-attachment-fetch'; De = 'Mail-Anhaenge lokal indexieren' }
    @{ Pat = 'app/files/|FilesShell'; De = 'neues Dateien-Modul (Cloud und Mail-Anhaenge)' }
    @{ Pat = 'drive-upload|drive-download|OneDriveExplorer'; De = 'OneDrive- und SharePoint-Upload' }
    @{ Pat = 'MailRightSidebar|mail-right-sidebar'; De = 'Kontext-Sidebar in Mail (Kontakt, Historie, Kalender)' }
    @{ Pat = 'contact-history|correspondence'; De = 'Korrespondenz-Historie pro Kontakt' }
    @{ Pat = 'quickstep'; De = 'QuickSteps erweitert' }
    @{ Pat = 'microsoft-ews|/ews/'; De = 'Microsoft-Mail per EWS (zusaetzlicher Transport)' }
    @{ Pat = 'Onboarding'; De = 'ueberarbeiteter Ersteinrichtungs-Assistent' }
    @{ Pat = 'AccountSetup|account-setup'; De = 'Konten- und Erscheinungsbild-Einstellungen' }
    @{ Pat = 'WindowTitlebar'; De = 'eigene Fenster-Titelleiste' }
    @{ Pat = 'HomeDashboard|dashboard-tile'; De = 'Home-Dashboard-Kacheln' }
    @{ Pat = 'Bookings'; De = 'Microsoft Bookings' }
    @{ Pat = 'ConnectionsCanvas|connections/'; De = 'Verbindungs-Graph' }
    @{ Pat = 'TasksShell|tasks/'; De = 'Aufgaben-Modul' }
    @{ Pat = 'NotesShell|notes/'; De = 'Notizen-Modul' }
    @{ Pat = 'PeopleShell|people/'; De = 'Personen/Kontakte' }
    @{ Pat = 'Composer|ReadingPane'; De = 'Composer und Lesefenster' }
    @{ Pat = 'calendar-event-reminder'; De = 'Termin-Erinnerungen' }
    @{ Pat = 'calendar-shell-storage'; De = 'Kalender-Layout speichern' }
  )

  foreach ($path in $Paths) {
    $base = [System.IO.Path]::GetFileName($path)
    foreach ($rule in $rules) {
      if ($path -match $rule.Pat -or $base -match $rule.Pat) {
        [void] $hints.Add($rule.De)
      }
    }
  }
  return @($hints)
}

$script:AreaCatalog = @(
  @{
    Id       = 'files'
    Patterns = @('/files/', 'mail-attachment', 'attachments-repo', 'attachment-category', 'attachment-filter', 'drive-', 'OneDriveExplorer')
    LabelDe  = 'Dateien'
    LabelEn  = 'Files'
    SummaryDe = 'Neues Dateien-Modul: Cloud-Dateien, Mail-Anhaenge und Index-Sync'
    SummaryEn = 'New Files module: cloud files, mail attachments, and index sync'
  }
  @{
    Id       = 'calendar'
    Patterns = @('/calendar/', 'CalendarEvent', 'calendar-service', 'calendar-graph', 'calendar-folders', 'Bookings', 'scheduling-draft', 'InboxCalendarSidebar')
    LabelDe  = 'Kalender'
    LabelEn  = 'Calendar'
    SummaryDe = 'Kalender und Termine: Dialog, Vorschau, Kategorien und Shell'
    SummaryEn = 'Calendar and events: dialog, preview, categories, and shell'
  }
  @{
    Id       = 'mail'
    Patterns = @('/layout/Mail', '/mail-', 'Composer', 'ReadingPane', 'MailList', 'MailWorkspace', 'message-', 'ews/', 'microsoft-ews', 'quickstep', 'snooze', 'correspondence')
    LabelDe  = 'Mail'
    LabelEn  = 'Mail'
    SummaryDe = 'Mail-Arbeitsbereich: Sidebar, Anhaenge, EWS und Aktionen'
    SummaryEn = 'Mail workspace: sidebar, attachments, EWS, and actions'
  }
  @{
    Id       = 'tasks'
    Patterns = @('/tasks/', 'cloud-tasks', 'tasks-graph', 'tasks-service', 'tasks-cache')
    LabelDe  = 'Aufgaben'
    LabelEn  = 'Tasks'
    SummaryDe = 'Aufgaben-Modul und Cloud-Tasks-Sync'
    SummaryEn = 'Tasks module and cloud task sync'
  }
  @{
    Id       = 'notes'
    Patterns = @('/notes/', 'MarkdownNote', 'user-note')
    LabelDe  = 'Notizen'
    LabelEn  = 'Notes'
    SummaryDe = 'Notizen und Kalender-Pane'
    SummaryEn = 'Notes and calendar pane'
  }
  @{
    Id       = 'people'
    Patterns = @('/people/', 'contact-', 'account-photo')
    LabelDe  = 'Personen'
    LabelEn  = 'People'
    SummaryDe = 'Kontakte und Avatare'
    SummaryEn = 'Contacts and avatars'
  }
  @{
    Id       = 'connections'
    Patterns = @('/connections/', 'entity-link', 'entity-palette')
    LabelDe  = 'Verbindungen'
    LabelEn  = 'Connections'
    SummaryDe = 'Verbindungs-Graph und Objekt-Verknuepfungen'
    SummaryEn = 'Connections graph and entity links'
  }
  @{
    Id       = 'home'
    Patterns = @('/home/', 'Dashboard', 'dashboard-tile')
    LabelDe  = 'Home'
    LabelEn  = 'Home'
    SummaryDe = 'Home-Dashboard und Kacheln'
    SummaryEn = 'Home dashboard and tiles'
  }
  @{
    Id       = 'settings'
    Patterns = @('account-setup/', 'Onboarding', 'FirstRun', 'settings-backup', 'SettingsTheme', 'SettingsDialog', 'SettingsMail', 'SettingsQuick', 'SettingsTopbar', 'SettingsAccounts')
    LabelDe  = 'Einstellungen'
    LabelEn  = 'Settings'
    SummaryDe = 'Einstellungen, Onboarding und Backup'
    SummaryEn = 'Settings, onboarding, and backup'
  }
  @{
    Id       = 'platform'
    Patterns = @('window-titlebar', 'WindowTitlebar', 'sync-runner', 'network-status', 'preload/', 'ipc/register')
    LabelDe  = 'Plattform'
    LabelEn  = 'Platform'
    SummaryDe = 'App-Shell, Sync und IPC'
    SummaryEn = 'App shell, sync, and IPC'
  }
)

function Build-AreaBullets {
  param(
    [string[]] $Paths,
    [string[]] $CommitSubjects,
    [string] $TargetVersion,
    [string] $Locale
  )

  $scored = @()
  foreach ($area in $script:AreaCatalog) {
    $matched = @($Paths | Where-Object { Test-PathMatches $_ $area.Patterns })
    if ((Get-CollectionCount $matched) -eq 0) { continue }
    $hints = Get-FileHints $matched
    $hintCount = Get-CollectionCount $hints
    $scored += [pscustomobject]@{
      Area          = $area
      Score         = (Get-CollectionCount $matched)
      WeightedScore = (Get-CollectionCount $matched) + ($hintCount * 4)
      Hints         = $hints
      Matched       = $matched
    }
  }

  $scored = @($scored | Sort-Object WeightedScore -Descending)
  $bullets = @()

  foreach ($item in ($scored | Select-Object -First 3)) {
    $a = $item.Area
    $label = if ($Locale -eq 'en') { $a.LabelEn } else { $a.LabelDe }
    $summary = if ($Locale -eq 'en') { $a.SummaryEn } else { $a.SummaryDe }
    $hintList = @($item.Hints)
    $detail = if ($Locale -eq 'en') {
      '{0} areas touched in this release' -f $item.Score
    } elseif ((Get-CollectionCount $hintList) -gt 0) {
      ($hintList | Select-Object -First 2) -join '; '
    } else {
      '{0} Datei(en) geaendert' -f $item.Score
    }
    if ($Locale -eq 'en') {
      $bullets += "- **${label}:** $summary"
    } else {
      $bullets += "- **${label}:** $summary ($detail)"
    }
  }

  foreach ($subject in ($CommitSubjects | Select-Object -First 2)) {
    if ((Get-CollectionCount $bullets) -ge 4) { break }
    $short = if ($subject.Length -gt 100) { $subject.Substring(0, 97) + '...' } else { $subject }
    if ($Locale -eq 'en') {
      $bullets += "- **Dev:** $short"
    } else {
      $bullets += "- **Sonstiges:** $short"
    }
  }

  while ((Get-CollectionCount $bullets) -lt 4) {
    $n = (Get-CollectionCount $bullets) + 1
    if ($Locale -eq 'en') {
      $bullets += "- **Release:** Further improvements and bug fixes in Chronell $TargetVersion"
    } else {
      $bullets += "- **Release:** Weitere Verbesserungen und Bugfixes in Chronell $TargetVersion"
    }
    if ($n -ge 4) { break }
  }

  $homepage = if ($Locale -eq 'en') {
    "Release notes, homepage timeline, and download for $TargetVersion"
  } else {
    "Release-Texte, Homepage-Timeline und Download auf $TargetVersion"
  }
  if ((Get-CollectionCount $bullets) -ge 4) {
    $bullets[3] = "- **Homepage:** $homepage"
  } else {
    $bullets += "- **Homepage:** $homepage"
  }

  return $bullets | Select-Object -First 4
}

function Build-Title {
  param(
    $ScoredAreas,
    [string] $Locale
  )

  $top = @($ScoredAreas | Select-Object -First 2)
  if ((Get-CollectionCount $top) -eq 0) {
    if ($Locale -eq 'en') { return 'Improvements and bug fixes' }
    return 'Verbesserungen und Bugfixes'
  }

  $labels = @(
    $top | ForEach-Object {
      if ($Locale -eq 'en') { $_.Area.LabelEn } else { $_.Area.LabelDe }
    }
  )
  if ((Get-CollectionCount $labels) -eq 1) {
    if ($Locale -eq 'en') { return "$($labels[0]) update" }
    return "$($labels[0])-Update"
  }
  if ((Get-CollectionCount $labels) -ge 3) {
    if ($Locale -eq 'en') {
      return "$($labels[0]), $($labels[1]) and $($labels[2])"
    }
    return "$($labels[0]), $($labels[1]) und $($labels[2])"
  }
  if ($Locale -eq 'en') {
    return "$($labels[0]) and $($labels[1])"
  }
  return "$($labels[0]) und $($labels[1])"
}

# --- main ---
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $repoRoot

$packageJson = Join-Path $repoRoot 'package.json'
if (-not $TargetVersion) {
  $pkg = Get-Content -LiteralPath $packageJson -Raw -Encoding UTF8 | ConvertFrom-Json
  $cur = [string] $pkg.version
  if ($cur -match '^(\d+)\.(\d+)\.(\d+)$') {
    $TargetVersion = '{0}.{1}.{2}' -f $Matches[1], $Matches[2], ([int]$Matches[3] + 1)
  } else {
    throw 'package.json-Version ungueltig.'
  }
}

if (-not $SinceTag) {
  $SinceTag = Resolve-ReleaseSinceTag -RepoRoot $repoRoot -TargetVersion $TargetVersion
}

if (-not $OutputFile) {
  $OutputFile = Join-Path $repoRoot 'docs\releases\UNRELEASED.md'
}

$paths = Get-ChangedPaths -RepoRoot $repoRoot -Ref $SinceTag
$commits = Get-CommitSubjects -RepoRoot $repoRoot -Ref $SinceTag

Write-Host ''
Write-Host 'Release-Notizen aus Git generieren' -ForegroundColor Cyan
$sinceLabel = if ($SinceTag) { "$SinceTag .. HEAD + Working Tree" } else { 'Working Tree (kein Release-Tag)'
}
Write-Host "  Basis:    $sinceLabel" -ForegroundColor DarkGray
Write-Host "  Version:  $TargetVersion" -ForegroundColor DarkGray
Write-Host "  Dateien:  $(Get-CollectionCount $paths)" -ForegroundColor DarkGray

if ((Get-CollectionCount $paths) -eq 0) {
  Write-Host '  Keine Aenderungen gefunden — Vorlage mit Hinweis.' -ForegroundColor Yellow
}

$scored = @()
foreach ($area in $script:AreaCatalog) {
  $matched = @($paths | Where-Object { Test-PathMatches $_ $area.Patterns })
  if ((Get-CollectionCount $matched) -gt 0) {
    $hintCount = Get-CollectionCount (Get-FileHints $matched)
    $scored += [pscustomobject]@{
      Area          = $area
      Score         = (Get-CollectionCount $matched)
      WeightedScore = (Get-CollectionCount $matched) + ($hintCount * 4)
    }
  }
}
$scored = @($scored | Sort-Object WeightedScore -Descending)

$titleDe = Build-Title -ScoredAreas $scored -Locale 'de'
$titleEn = Build-Title -ScoredAreas $scored -Locale 'en'
$bulletsDe = Build-AreaBullets -Paths $paths -CommitSubjects $commits -TargetVersion $TargetVersion -Locale 'de'
$bulletsEn = Build-AreaBullets -Paths $paths -CommitSubjects $commits -TargetVersion $TargetVersion -Locale 'en'
$dateLabel = Get-GermanDateLabel

$content = (
  @(
    "## $TargetVersion - $dateLabel",
    '',
    "title-de: $titleDe",
    "title-en: $titleEn",
    ''
  ) + $bulletsDe + @('', '## EN', '') + $bulletsEn + @('')
) -join "`n"

if ($DryRun) {
  Write-Host ''
  Write-Host $content -ForegroundColor DarkGray
} else {
  $dir = Split-Path -Parent $OutputFile
  if (-not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  [System.IO.File]::WriteAllText($OutputFile, $content, [System.Text.UTF8Encoding]::new($false))
  Write-Host "  Geschrieben: $OutputFile" -ForegroundColor Green
}

$result = [pscustomobject]@{
  TargetVersion = $TargetVersion
  SinceTag      = $SinceTag
  FileCount     = (Get-CollectionCount $paths)
  OutputFile    = $OutputFile
  Content       = $content
}

# git diff liefert Exit-Code 1 bei Aenderungen — kein Fehler fuer dieses Script.
$global:LASTEXITCODE = 0
return $result
