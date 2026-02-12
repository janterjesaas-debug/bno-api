#requires -version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ============================
# Stranda availability (Mews)
# ============================

Set-Location "C:\Users\jante\bno-api"

# 1) Load .env into current process (KEY=VALUE)
Get-Content .\.env -ErrorAction Stop | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#") -or -not ($line -match "=")) { return }
  $k, $v = $line -split "=", 2
  $k = $k.Trim()
  $v = $v.Trim().Trim('"')
  [System.Environment]::SetEnvironmentVariable($k, $v, "Process")
}
Write-Host "Loaded .env into current PowerShell process." -ForegroundColor Green

# 2) Pick STRANDA creds
$base        = if ($env:MEWS_BASE_URL_STRANDA) { $env:MEWS_BASE_URL_STRANDA } elseif ($env:MEWS_BASE_URL) { $env:MEWS_BASE_URL } else { "https://api.mews.com" }
$svc         = $env:MEWS_SERVICE_ID_STRANDA
$ent         = $env:MEWS_ENTERPRISE_ID_STRANDA
$access      = $env:MEWS_ACCESS_TOKEN_STRANDA
$clientToken = if ($env:MEWS_CLIENT_TOKEN_STRANDA) { $env:MEWS_CLIENT_TOKEN_STRANDA } else { $env:MEWS_CLIENT_TOKEN }
$clientName  = if ($env:MEWS_CLIENT_NAME) { $env:MEWS_CLIENT_NAME } else { "bno-api" }

# Windows timezone id used for correct UTC conversion (Oslo)
$tzWin = if ($env:HOTEL_TIMEZONE_WINDOWS) { $env:HOTEL_TIMEZONE_WINDOWS } else { "W. Europe Standard Time" }

if (-not $svc)         { throw "Missing MEWS_SERVICE_ID_STRANDA in .env" }
if (-not $ent)         { throw "Missing MEWS_ENTERPRISE_ID_STRANDA in .env" }
if (-not $access)      { throw "Missing MEWS_ACCESS_TOKEN_STRANDA in .env" }
if (-not $clientToken) { throw "Missing MEWS_CLIENT_TOKEN (and MEWS_CLIENT_TOKEN_STRANDA not set)" }

Write-Host "== Using ==" -ForegroundColor Cyan
Write-Host "base=$base"
Write-Host "serviceId=$svc"
Write-Host "enterpriseId=$ent"
Write-Host "clientName=$clientName"
Write-Host "tzWindows=$tzWin"

# 3) Time helper: local midnight (Oslo) -> UTC ISO with colons
Add-Type -AssemblyName System.Globalization | Out-Null
$inv = [System.Globalization.CultureInfo]::InvariantCulture

function Get-LocalMidnightUtcIso([string]$ymd, [string]$windowsTzId) {
  try { $tz = [System.TimeZoneInfo]::FindSystemTimeZoneById($windowsTzId) }
  catch { $tz = [System.TimeZoneInfo]::Utc }

  $dtLocal = [datetime]::ParseExact($ymd, "yyyy-MM-dd", $inv)
  $dtLocal = [datetime]::SpecifyKind($dtLocal, [System.DateTimeKind]::Unspecified)

  $utc = [System.TimeZoneInfo]::ConvertTimeToUtc($dtLocal, $tz)
  return $utc.ToString("yyyy-MM-dd'T'HH':'mm':'ss'Z'", $inv)
}

# 4) HTTP helper (PS 5.1-safe)
function Invoke-MewsPostJson([string]$path, [hashtable]$body) {
  $url = "$base$path"
  $json = $body | ConvertTo-Json -Depth 50

  try {
    $r = Invoke-WebRequest -Method POST -Uri $url -ContentType "application/json" -Body $json -ErrorAction Stop
    if (-not $r.Content) { return $null }
    return ($r.Content | ConvertFrom-Json)
  }
  catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $status = [int]$resp.StatusCode
      $desc   = $resp.StatusDescription
      $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
      $text = $sr.ReadToEnd()
      Write-Host "HTTP $status $desc ($path)" -ForegroundColor Yellow
      Write-Host "BODY:`n$text" -ForegroundColor Yellow
      return $null
    }
    throw
  }
}

# ---------------------------
# INPUT: set dates here
# Convention A (recommended): from=checkin, to=checkout (to is EXCLUSIVE)
# Example: checkin 2026-02-10, checkout 2026-02-12 means nights 10->11 (2 nights)
# ---------------------------
$from = "2026-02-10"
$to   = "2026-02-12"  # checkout (exclusive)

# Mews endpoint includes the end boundary; safest is to include last included day:
# lastIncluded = checkout - 1 day
$lastIncluded = (Get-Date $to).AddDays(-1).ToString("yyyy-MM-dd", $inv)

$firstTU = Get-LocalMidnightUtcIso $from $tzWin
$lastTU  = Get-LocalMidnightUtcIso $lastIncluded $tzWin

Write-Host "`nAvailability query:" -ForegroundColor Cyan
Write-Host "  checkin(from)=$from  checkout(to)=$to (exclusive)"
Write-Host "  FirstTimeUnitStartUtc=$firstTU"
Write-Host "  LastTimeUnitStartUtc =$lastTU"

# 5) Load categories (id -> name/short/capacity)
$catsResp = Invoke-MewsPostJson "/api/connector/v1/resourceCategories/getAll" @{
  ClientToken = $clientToken
  AccessToken = $access
  Client      = $clientName
  ServiceIds  = @($svc)
  Limitation  = @{ Count = 1000 }
}

$catMap = @{}
if ($catsResp -and $catsResp.ResourceCategories) {
  foreach ($c in $catsResp.ResourceCategories) {
    $name  = $null
    $short = $null
    try { $name  = $c.Names.'en-US' } catch {}
    try { $short = $c.ShortNames.'en-US' } catch {}
    if (-not $name) { $name = $c.Id }

    $catMap[$c.Id] = [pscustomobject]@{
      Name     = $name
      Short    = $short
      Capacity = $c.Capacity
    }
  }
  Write-Host "Loaded ResourceCategories: $($catsResp.ResourceCategories.Count)" -ForegroundColor Green
} else {
  Write-Host "WARNING: Could not load ResourceCategories." -ForegroundColor Yellow
}

# 6) Availability
$avail = Invoke-MewsPostJson "/api/connector/v1/services/getAvailability" @{
  ClientToken = $clientToken
  AccessToken = $access
  Client      = $clientName
  ServiceId   = $svc
  FirstTimeUnitStartUtc = $firstTU
  LastTimeUnitStartUtc  = $lastTU
}

if (-not $avail) { throw "getAvailability returned null. See HTTP/BODY above." }

# 7) Parse CategoryAvailabilities (int array)
$rows = @()
if ($avail.CategoryAvailabilities) { $rows = @($avail.CategoryAvailabilities) }
if ($rows.Count -eq 0) {
  Write-Host "No CategoryAvailabilities returned. Keys were:" -ForegroundColor Yellow
  $avail.PSObject.Properties.Name | Sort-Object | Out-Host
  exit 1
}

$report = foreach ($row in $rows) {
  $id = $row.CategoryId
  $meta = $null
  if ($id -and $catMap.ContainsKey($id)) { $meta = $catMap[$id] }

  $vals = @()
  foreach ($n in @($row.Availabilities)) { $vals += [int]$n }

  $minAvail = ($vals | Measure-Object -Minimum).Minimum
  $maxAvail = ($vals | Measure-Object -Maximum).Maximum

  [pscustomobject]@{
    CategoryId = $id
    Short      = if ($meta) { $meta.Short } else { $null }
    Name       = if ($meta) { $meta.Name } else { $null }
    Capacity   = if ($meta) { $meta.Capacity } else { $null }
    MinAvail   = $minAvail
    MaxAvail   = $maxAvail
    Availabilities = $vals
  }
}

Write-Host "`n=== BOOKABLE for entire stay (MinAvail > 0) ===" -ForegroundColor Cyan
$bookable = $report | Where-Object { $_.MinAvail -gt 0 } |
  Sort-Object @{Expression="MinAvail";Descending=$true}, @{Expression="MaxAvail";Descending=$true}

$bookable | Select-Object CategoryId, Short, Name, Capacity, MinAvail, MaxAvail | Format-Table -AutoSize

# 8) Also save JSON for frontend use
$out = [pscustomobject]@{
  serviceId = $svc
  from      = $from
  to        = $to
  firstTimeUnitStartUtc = $firstTU
  lastTimeUnitStartUtc  = $lastTU
  timeUnitsUtc          = @($avail.TimeUnitStartsUtc)
  categories            = @($report | Sort-Object Name)
  bookable              = @($bookable)
}

$outPath = Join-Path (Get-Location) "stranda-availability.json"
$out | ConvertTo-Json -Depth 20 | Out-File -Encoding UTF8 $outPath
Write-Host "`nSaved JSON: $outPath" -ForegroundColor Green
