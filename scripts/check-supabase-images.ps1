# scripts/check-supabase-images.ps1
# Kjør: powershell -ExecutionPolicy Bypass -File .\scripts\check-supabase-images.ps1
# Krever env:
#   $env:SUPABASE_URL
#   $env:SUPABASE_SERVICE_ROLE_KEY (eller SUPABASE_ANON_KEY)
# Optional:
#   $env:API_BASE (default http://localhost:3000)

$ErrorActionPreference = "Stop"

function Get-Key() {
  if ($env:SUPABASE_SERVICE_ROLE_KEY -and $env:SUPABASE_SERVICE_ROLE_KEY.Trim().Length -gt 0) { return $env:SUPABASE_SERVICE_ROLE_KEY.Trim() }
  if ($env:SUPABASE_SERVICE_KEY -and $env:SUPABASE_SERVICE_KEY.Trim().Length -gt 0) { return $env:SUPABASE_SERVICE_KEY.Trim() }
  if ($env:SUPABASE_ANON_KEY -and $env:SUPABASE_ANON_KEY.Trim().Length -gt 0) { return $env:SUPABASE_ANON_KEY.Trim() }
  if ($env:NEXT_PUBLIC_SUPABASE_ANON_KEY -and $env:NEXT_PUBLIC_SUPABASE_ANON_KEY.Trim().Length -gt 0) { return $env:NEXT_PUBLIC_SUPABASE_ANON_KEY.Trim() }
  throw "Mangler SUPABASE_SERVICE_ROLE_KEY eller SUPABASE_ANON_KEY i env"
}

function Get-BaseUrl() {
  if (-not $env:SUPABASE_URL -or $env:SUPABASE_URL.Trim().Length -eq 0) {
    throw "Mangler SUPABASE_URL i env"
  }
  return $env:SUPABASE_URL.Trim().TrimEnd("/")
}

function Test-HeadGet($url, $headers) {
  $result = [PSCustomObject]@{ ok = $false; status = $null; error = $null }

  try {
    $r = Invoke-WebRequest -Method Head -Uri $url -Headers $headers -MaximumRedirection 5 -TimeoutSec 25
    $result.ok = $true
    $result.status = $r.StatusCode
    return $result
  } catch {
    $result.error = $_.Exception.Message
    try {
      $resp = $_.Exception.Response
      if ($resp -and $resp.StatusCode) { $result.status = [int]$resp.StatusCode }
    } catch {}
  }

  try {
    $r2 = Invoke-WebRequest -Method Get -Uri $url -Headers $headers -MaximumRedirection 5 -TimeoutSec 25
    $result.ok = $true
    $result.status = $r2.StatusCode
    return $result
  } catch {
    if (-not $result.error) { $result.error = $_.Exception.Message }
    try {
      $resp = $_.Exception.Response
      if ($resp -and $resp.StatusCode) { $result.status = [int]$resp.StatusCode }
    } catch {}
  }

  return $result
}

Write-Host "Testing Supabase public image URLs (with headers) + API proxy..." -ForegroundColor Cyan

$supabaseUrl = Get-BaseUrl
$key = Get-Key

$headers = @{
  "apikey"        = $key
  "Authorization" = "Bearer $key"
}

$urls = @(
  "$supabaseUrl/storage/v1/object/public/bno-images/Mountain-Lodge-Strandafjellet3014-26-1024x683.jpg",
  "$supabaseUrl/storage/v1/object/public/bno-images/Koie-Fjellsaetra-Alpegrend_01-1024x768.jpg",
  "$supabaseUrl/storage/v1/object/public/bno-images/lake%20View%20Apartment%202%20soverom.jpg",
  "$supabaseUrl/storage/v1/object/public/bno-images/okslevegen%202.jpg",
  "$supabaseUrl/storage/v1/object/public/bno-images/Lastolen%203%20soverom.jpg",
  "$supabaseUrl/storage/v1/object/public/bno-images/stranda%20fjellgrend%202%20soverom%20og%20hems.jpg"
)

$apiBase = $env:API_BASE
if (-not $apiBase -or $apiBase.Trim().Length -eq 0) { $apiBase = "http://localhost:3000" }
$apiBase = $apiBase.Trim().TrimEnd("/")

foreach ($u in $urls) {
  $r = Try-HeadGet $u $headers
  if ($r.ok) {
    Write-Host "OK   $($r.status)  $u" -ForegroundColor Green
  } else {
    $st = if ($r.status) { $r.status } else { "??" }
    Write-Host "FAIL $st  $u" -ForegroundColor Red
    if ($r.error) { Write-Host ("     err: " + $r.error) -ForegroundColor DarkGray }
  }

  # test proxy også
  $proxy = $u -replace [regex]::Escape("$supabaseUrl/storage/v1/object/public/"), "$apiBase/api/img/"
  $r2 = Try-HeadGet $proxy @{}
  if ($r2.ok) {
    Write-Host "OK   $($r2.status)  PROXY $proxy" -ForegroundColor Green
  } else {
    $st2 = if ($r2.status) { $r2.status } else { "??" }
    Write-Host "FAIL $st2  PROXY $proxy" -ForegroundColor Yellow
    if ($r2.error) { Write-Host ("     err: " + $r2.error) -ForegroundColor DarkGray }
  }

  Write-Host ""
}