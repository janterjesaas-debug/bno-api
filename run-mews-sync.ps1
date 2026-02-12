# C:\Users\jante\bno-api\run-mews-sync.ps1
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repo = "C:\Users\jante\bno-api"

# Sørg for at repo finnes
if (-not (Test-Path -LiteralPath $repo)) {
  throw "Repo path finnes ikke: $repo"
}

Set-Location $repo

# Sørg for at scriptet vi skal kjøre finnes
$tsScript = Join-Path $repo "scripts\mews-sync-cleaning.ts"
if (-not (Test-Path -LiteralPath $tsScript)) {
  throw "Fant ikke TS-script: $tsScript"
}

# Default sync-vindu hvis ikke allerede satt av Task/Environment
if (-not $env:MEWS_SYNC_DAYS_BACK)  { $env:MEWS_SYNC_DAYS_BACK  = "7" }
if (-not $env:MEWS_SYNC_DAYS_AHEAD) { $env:MEWS_SYNC_DAYS_AHEAD = "180" }

# DRY_RUN: la være tom som default (OFF). Hvis du vil tvinge DRY_RUN i task, sett den der.
# if (-not $env:DRY_RUN) { $env:DRY_RUN = "" }

# Logg
$logDir = Join-Path $repo "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$ts = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logFile = Join-Path $logDir "mews-sync_$ts.log"

Start-Transcript -Path $logFile -Append | Out-Null

try {
  Write-Host "== RUN MEWS SYNC =="
  Write-Host "Repo: $repo"
  Write-Host "MEWS_SYNC_DAYS_BACK=$env:MEWS_SYNC_DAYS_BACK  MEWS_SYNC_DAYS_AHEAD=$env:MEWS_SYNC_DAYS_AHEAD  DRY_RUN=$env:DRY_RUN"

  # Viktig: --yes hindrer npx fra å spørre interaktivt
  npx --yes ts-node .\scripts\mews-sync-cleaning.ts

  $code = $LASTEXITCODE
  if ($code -ne 0) {
    throw "mews-sync-cleaning.ts exit code: $code"
  }

  Write-Host "OK"
  Stop-Transcript | Out-Null
  exit 0
}
catch {
  Write-Error $_
  try { Stop-Transcript | Out-Null } catch {}
  exit 1
}
