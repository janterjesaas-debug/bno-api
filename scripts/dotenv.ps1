# scripts/dotenv.ps1
# Loads .env into CURRENT PowerShell process so $env:... works in your session.
# Usage:
#   . .\scripts\dotenv.ps1
#   $env:MEWS_SERVICE_ID_TANDADALEN_SALEN

[CmdletBinding()]
param(
  [Parameter(Mandatory=$false)]
  [string]$Path,

  [Parameter(Mandatory=$false)]
  [switch]$Quiet
)

function Import-DotEnv {
  param([string]$DotEnvPath)

  if (-not (Test-Path $DotEnvPath)) {
    throw "dotenv: Fant ikke .env på: $DotEnvPath"
  }

  $lines = Get-Content $DotEnvPath -ErrorAction Stop
  foreach ($raw in $lines) {
    $line = $raw.Trim()
    if (-not $line) { continue }
    if ($line.StartsWith('#')) { continue }

    $idx = $line.IndexOf('=')
    if ($idx -lt 1) { continue }

    $k = $line.Substring(0, $idx).Trim()
    $v = $line.Substring($idx + 1).Trim()

    # Strip UTF-8 BOM if present on first key
    $k = $k.TrimStart([char]0xFEFF)

    if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
      $v = $v.Substring(1, $v.Length - 2)
    }

    if ($k) {
      [Environment]::SetEnvironmentVariable($k, $v, 'Process')
    }
  }
}

# Resolve repo root from this script location
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path

if (-not $Path -or -not $Path.Trim()) {
  $Path = Join-Path $repoRoot '.env'
}

Import-DotEnv -DotEnvPath $Path

if (-not $Quiet) {
  Write-Host ("dotenv: Loaded {0}" -f $Path)
}