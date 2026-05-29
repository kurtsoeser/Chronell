#Requires -Version 5.1
<#
.SYNOPSIS
  Wendet Release-Notizen aus docs/releases/UNRELEASED.md auf FUNKTIONSPROTOKOLL, Homepage-i18n und index.html an.

.PARAMETER NotesFile
  Pfad zur Markdown-Datei mit Release-Notizen.

.PARAMETER DryRun
  Nur anzeigen, keine Dateien schreiben.

.EXAMPLE
  .\scripts\sync-release-docs.ps1
  .\scripts\sync-release-docs.ps1 -NotesFile docs/releases/0.9.24.md -DryRun
#>
[CmdletBinding()]
param(
  [string] $NotesFile,
  [switch] $DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step([string] $Message) {
  Write-Host ''
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Get-VersionKey([string] $Version) {
  if ($Version -notmatch '^(\d+)\.(\d+)\.(\d+)$') {
    throw "Ungueltige Version '$Version'."
  }
  return ('v{0}{1}{2}' -f $Matches[1], $Matches[2], $Matches[3])
}

function ConvertTo-I18nBullet([string] $Line) {
  $t = $Line.Trim()
  if ($t -match '^-\s+(.+)$') {
    $t = $Matches[1]
  }
  $t = $t -replace '^\*\*([^*]+):\*\*\s*', '$1: '
  return $t.Trim()
}

function Get-TitleFromBullets([string[]] $Bullets) {
  $labels = @()
  foreach ($b in $Bullets) {
    if ($b -match '\*\*([^*]+):\*\*') {
      $labels += $Matches[1].Trim()
    }
    if ($labels.Count -ge 3) { break }
  }
  if ($labels.Count -eq 0) {
    return 'Neues Update'
  }
  if ($labels.Count -eq 1) { return $labels[0] }
  if ($labels.Count -eq 2) { return ('{0} & {1}' -f $labels[0], $labels[1]) }
  return ('{0}, {1} & {2}' -f $labels[0], $labels[1], $labels[2])
}

function Parse-ReleaseNotes([string] $Raw) {
  $deSection = $Raw
  $enSection = $null
  if ($Raw -match '(?ms)^##\s+EN\s*$') {
    $parts = $Raw -split '(?m)^##\s+EN\s*$', 2
    $deSection = $parts[0]
    $enSection = $parts[1]
  }

  if ($deSection -notmatch '(?m)^##\s+(\d+\.\d+\.\d+)\s*-\s*(.+?)\s*$') {
    throw 'Erwartete Zeile: ## 0.9.24 - 29. Mai 2026'
  }

  $version = $Matches[1]
  $dateLabel = $Matches[2].Trim()
  $rest = $deSection.Substring($deSection.IndexOf($Matches[0]) + $Matches[0].Length)

  $titleDe = $null
  $titleEn = $null
  if ($rest -match '(?m)^title-de:\s*(.+?)\s*$') {
    $titleDe = $Matches[1].Trim()
    $rest = $rest -replace '(?m)^title-de:\s*.+?\s*$\r?\n?', ''
  }
  if ($rest -match '(?m)^title-en:\s*(.+?)\s*$') {
    $titleEn = $Matches[1].Trim()
    $rest = $rest -replace '(?m)^title-en:\s*.+?\s*$\r?\n?', ''
  }

  $bulletsDe = @(
    $rest -split "`n" |
      Where-Object { $_ -match '^\s*-\s+' } |
      ForEach-Object { $_.Trim() }
  )
  if ($bulletsDe.Count -lt 1) {
    throw 'Mindestens ein Aufzaehlungspunkt (- ...) erforderlich.'
  }

  $bulletsEn = $bulletsDe
  if ($enSection) {
    $bulletsEn = @(
      $enSection -split "`n" |
        Where-Object { $_ -match '^\s*-\s+' } |
        ForEach-Object { $_.Trim() }
    )
    if ($bulletsEn.Count -lt 1) {
      $bulletsEn = $bulletsDe
    }
  }

  if (-not $titleDe) { $titleDe = Get-TitleFromBullets $bulletsDe }
  if (-not $titleEn) { $titleEn = Get-TitleFromBullets $bulletsEn }

  $monthYear = $dateLabel
  if ($dateLabel -match '(?:\d{1,2}\.\s*)?(\w+)\s+(\d{4})') {
    $monthToken = $Matches[1].ToLower()
    $yearToken = $Matches[2]
    $monthYear = switch -Regex ($monthToken) {
      'januar|january|jan' { "Januar $yearToken" }
      'februar|february|feb' { "Februar $yearToken" }
      'maerz|march|mar' { "März $yearToken" }
      'april|apr' { "April $yearToken" }
      'mai|may' { "Mai $yearToken" }
      'juni|june|jun' { "Juni $yearToken" }
      'juli|july|jul' { "Juli $yearToken" }
      'august|aug' { "August $yearToken" }
      'september|sep' { "September $yearToken" }
      'oktober|october|oct' { "Oktober $yearToken" }
      'november|nov' { "November $yearToken" }
      'dezember|december|dec' { "Dezember $yearToken" }
      default { "$($Matches[1]) $yearToken" }
    }
  }

  $historyBlock = "### $version - $dateLabel`n`n" + ($bulletsDe -join "`n")

  return [pscustomobject]@{
    Version       = $version
    DateLabel     = $dateLabel
    MonthYear     = $monthYear
    VersionKey    = Get-VersionKey $version
    TitleDe       = $titleDe
    TitleEn       = $titleEn
    BulletsDe     = $bulletsDe
    BulletsEn     = $bulletsEn
    HistoryBlock  = $historyBlock
    GhReleaseNotes = ($historyBlock + "`n`nDownload: https://chronell.app/")
  }
}

function Update-Funktionsprotokoll {
  param($Info, [string] $Path)

  $raw = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
  $prevVersion = $null
  if ($raw -match '\|\s*\*\*Version\*\*\s*\|\s*\*\*([0-9]+\.[0-9]+\.[0-9]+)\*\*') {
    $prevVersion = $Matches[1]
  }

  $updated = $raw -replace '(\|\s*\*\*Version\*\*\s*\|\s*\*\*)[0-9]+\.[0-9]+\.[0-9]+(\*\*)', "`${1}$($Info.Version)`${2}"
  $updated = $updated -replace '(\|\s*\*\*Stand\*\*\s*\|\s*\*\*)[^|]+(\*\*)', "`${1}$($Info.DateLabel)`${2}"

  $marker = '## 20. Versionshistorie'
  if ($updated -notmatch [regex]::Escape($marker)) {
    throw 'Abschnitt ## 20. Versionshistorie nicht gefunden.'
  }

  if ($updated -match "(?m)^###\s+$([regex]::Escape($Info.Version))\s*-") {
    Write-Host "  FUNKTIONSPROTOKOLL: Eintrag $($Info.Version) wird ersetzt." -ForegroundColor DarkGray
    $updated = $updated -replace "(?ms)^###\s+$([regex]::Escape($Info.Version))\s*-[^\n]*\n(?:\n|(?![#]).*\n)*", ($Info.HistoryBlock + "`n`n")
  } else {
    $idx = $updated.IndexOf($marker)
    $insertAt = $idx + $marker.Length
    $updated = $updated.Insert($insertAt, "`n`n" + $Info.HistoryBlock + "`n")
  }

  $footer = "*Letzte Aktualisierung dieses Dokuments: $($Info.DateLabel) · Version $($Info.Version)*"
  $updated = $updated -replace '\*Letzte Aktualisierung dieses Dokuments:[^\*]+\*', $footer

  if ($prevVersion -and $prevVersion -ne $Info.Version) {
    Write-Host "  FUNKTIONSPROTOKOLL: Version $prevVersion -> $($Info.Version)" -ForegroundColor DarkGray
  }

  if (-not $DryRun) {
    [System.IO.File]::WriteAllText($Path, $updated, [System.Text.UTF8Encoding]::new($false))
  }
}

function Escape-JsonString([string] $Value) {
  return ($Value -replace '\\', '\\\\' -replace '"', '\"')
}

function Update-I18nFile {
  param(
    $Info,
    [string] $Path,
    [string] $Locale
  )

  $raw = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
  $prevVersion = $null
  if ($raw -match 'Chronell\s+([0-9]+\.[0-9]+\.[0-9]+)') {
    $prevVersion = $Matches[1]
  }
  if ($prevVersion -and $prevVersion -ne $Info.Version) {
    $raw = $raw -replace [regex]::Escape($prevVersion), $Info.Version
  }

  $title = if ($Locale -eq 'en') { $Info.TitleEn } else { $Info.TitleDe }
  $bullets = if ($Locale -eq 'en') { $Info.BulletsEn } else { $Info.BulletsDe }
  $b1 = ConvertTo-I18nBullet $bullets[0]
  $b2 = if ($bullets.Count -gt 1) { ConvertTo-I18nBullet $bullets[1] } else { '' }
  $b3 = if ($bullets.Count -gt 2) { ConvertTo-I18nBullet $bullets[2] } else { '' }
  $b4 = if ($bullets.Count -gt 3) { ConvertTo-I18nBullet $bullets[3] } else { $b3 }

  $key = $Info.VersionKey
  $badgeVal = if ($Locale -eq 'de') { 'Aktuell' } else { 'Current' }

  $newBlock = @"
    "$key": {
      "badge": "$badgeVal",
      "date": "$(Escape-JsonString $Info.MonthYear)",
      "title": "$(Escape-JsonString $title)",
      "b1": "$(Escape-JsonString $b1)",
      "b2": "$(Escape-JsonString $b2)",
      "b3": "$(Escape-JsonString $b3)",
      "b4": "$(Escape-JsonString $b4)"
    },
"@

  $raw = $raw -replace '(?m)^\s*"badge"\s*:\s*"(?:Aktuell|Current)",\s*\r?\n', ''

  if ($raw -match "(?ms)`"$([regex]::Escape($key))`"\s*:\s*\{.*?\},\s*") {
    $raw = $raw -replace "(?ms)`"$([regex]::Escape($key))`"\s*:\s*\{.*?\},\s*", $newBlock
  } elseif ($raw -match '(?ms)("updates"\s*:\s*\{.*?"lead"\s*:\s*"[^"]*",)\s*') {
    $raw = $raw -replace '(?ms)("updates"\s*:\s*\{.*?"lead"\s*:\s*"[^"]*",)\s*', "`${1}`n$newBlock"
  } else {
    throw "updates-Abschnitt in $Path nicht gefunden."
  }

  if ($raw -match '(?ms)"updates"\s*:\s*\{') {
    $updatesKeys = [regex]::Matches($raw, '(?m)^    "(v09\d{2})"\s*:\s*\{') |
      ForEach-Object { $_.Groups[1].Value } |
      Select-Object -Unique
    if ($updatesKeys.Count -gt 7) {
      $oldest = $updatesKeys | Sort-Object { [int]($_.Substring(1)) } | Select-Object -First 1
      $raw = $raw -replace "(?m)^    `"$([regex]::Escape($oldest))`"\s*:\s*\{.*?\},\s*\r?\n", ''
      Write-Host "  $Path : aeltester updates.$oldest entfernt (max. 7)." -ForegroundColor DarkGray
    }
  }

  if (-not $DryRun) {
    [System.IO.File]::WriteAllText($Path, $raw, [System.Text.UTF8Encoding]::new($false))
  }
}

function Update-IndexHtml {
  param($Info, [string] $Path)

  $raw = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
  $key = $Info.VersionKey
  $ver = $Info.Version
  $titleEsc = ($Info.TitleDe -replace '&', '&amp;') -replace '<', '&lt;'

  $newCard = @"
            <article class="release-card release-card--latest glass-panel-elevated reveal">
              <div class="release-card-head">
                <span class="release-badge" data-i18n="updates.$key.badge">Aktuell</span>
                <span class="release-version">$ver</span>
                <span class="release-date" data-i18n="updates.$key.date">$($Info.MonthYear)</span>
              </div>
              <h3 data-i18n="updates.$key.title">$titleEsc</h3>
              <ul class="release-bullets">
                <li data-i18n="updates.$key.b1"></li>
                <li data-i18n="updates.$key.b2"></li>
                <li data-i18n="updates.$key.b3"></li>
                <li data-i18n="updates.$key.b4"></li>
              </ul>
            </article>

"@

  if ($raw -match 'release-card--latest') {
    $raw = $raw -replace 'release-card--latest\s+', ''
    $raw = $raw -replace '(<span class="release-badge"[^>]*>)[^<]*(</span>)', '${1}${2}'
  }

  if ($raw -match '(?s)(<div class="release-timeline">)\s*') {
    $raw = $raw -replace '(?s)(<div class="release-timeline">)\s*', "`${1}`n$newCard"
  } else {
    throw 'release-timeline in index.html nicht gefunden.'
  }

  $articles = [regex]::Matches($raw, '<article class="release-card[^"]*"')
  if ($articles.Count -gt 7) {
    $raw = $raw -replace '(?s)<article class="release-card glass-panel reveal reveal-delay-6">.*?</article>\s*', ''
    Write-Host '  index.html: aelteste Release-Card entfernt (max. 7).' -ForegroundColor DarkGray
  }

  if (-not $DryRun) {
    [System.IO.File]::WriteAllText($Path, $raw, [System.Text.UTF8Encoding]::new($false))
  }
}

# --- main ---
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $repoRoot

if (-not $NotesFile) {
  $NotesFile = Join-Path $repoRoot 'docs\releases\UNRELEASED.md'
}
if (-not (Test-Path -LiteralPath $NotesFile)) {
  throw "Release-Notizen nicht gefunden: $NotesFile"
}

Write-Step 'Release-Dokumentation synchronisieren'
Write-Host "  Quelle: $NotesFile" -ForegroundColor DarkGray

$notesRaw = Get-Content -LiteralPath $NotesFile -Raw -Encoding UTF8
$info = Parse-ReleaseNotes $notesRaw

Write-Host "  Version: $($info.Version) ($($info.DateLabel))" -ForegroundColor DarkGray
Write-Host "  Titel:   $($info.TitleDe)" -ForegroundColor DarkGray

$fpPath = Join-Path $repoRoot 'docs\FUNKTIONSPROTOKOLL.md'
$dePath = Join-Path $repoRoot 'docs\i18n\de.json'
$enPath = Join-Path $repoRoot 'docs\i18n\en.json'
$indexPath = Join-Path $repoRoot 'docs\index.html'

Update-Funktionsprotokoll -Info $info -Path $fpPath
Update-I18nFile -Info $info -Path $dePath -Locale 'de'
Update-I18nFile -Info $info -Path $enPath -Locale 'en'
Update-IndexHtml -Info $info -Path $indexPath

$notesOutPath = Join-Path $repoRoot ('docs\releases\' + $info.Version + '.md')
if (-not $DryRun) {
  Copy-Item -LiteralPath $NotesFile -Destination $notesOutPath -Force
  $ghNotesPath = Join-Path $repoRoot 'docs\releases\latest-gh-notes.md'
  [System.IO.File]::WriteAllText($ghNotesPath, $info.GhReleaseNotes, [System.Text.UTF8Encoding]::new($false))
}

if ($DryRun) {
  Write-Host 'DryRun: keine Dateien geschrieben.' -ForegroundColor Yellow
} else {
  Write-Host 'Dokumentation aktualisiert.' -ForegroundColor Green
}

return $info
