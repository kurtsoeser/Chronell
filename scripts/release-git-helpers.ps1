#Requires -Version 5.1
<#
.SYNOPSIS
  Git/gh-Aufrufe ohne PowerShell-Fehler durch stderr (z. B. CRLF-Warnungen, "release not found").
#>

function Invoke-GitCli {
  param([Parameter(Mandatory)][string[]] $GitArgs)

  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = & git @GitArgs 2>&1
  $code = if ($null -ne $LASTEXITCODE) { [int] $LASTEXITCODE } else { 0 }
  $ErrorActionPreference = $prev

  return [pscustomobject]@{
    ExitCode = $code
    Output   = @($output)
  }
}

function Invoke-GhCli {
  param([Parameter(Mandatory)][string[]] $GhArgs)

  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = & gh @GhArgs 2>&1
  $code = if ($null -ne $LASTEXITCODE) { [int] $LASTEXITCODE } else { 0 }
  $ErrorActionPreference = $prev

  return [pscustomobject]@{
    ExitCode = $code
    Output   = @($output)
  }
}

function Write-CliFailure {
  param(
    [Parameter(Mandatory)] $Result,
    [Parameter(Mandatory)][string] $Context
  )

  if ($Result.ExitCode -eq 0) { return }
  Write-Host "  $Context" -ForegroundColor Yellow
  foreach ($line in $Result.Output) {
    if ([string]::IsNullOrWhiteSpace([string] $line)) { continue }
    Write-Host "    $line" -ForegroundColor DarkYellow
  }
}
