param(
  [Parameter(Mandatory=$false)][string]$NameContains = "",
  [Parameter(Mandatory=$false)][switch]$OnlyActive
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Ensure TLS 1.2 on older Windows/PS 5.1
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

function Test-HasProp($obj, [string]$name) {
  return ($null -ne $obj) -and ($obj.PSObject.Properties.Name -contains $name)
}

# Load .env into current process (simple KEY=VALUE)
$root = Get-Location
$envPath = Join-Path $root ".env"
if (-not (Test-Path $envPath)) { throw "Missing .env at: $envPath" }

Get-Content $envPath -ErrorAction Stop | ForEach-Object {
  $line = $_.Trim()
  if (-not $line) { return }
  if ($line.StartsWith("#")) { return }
  if (-not ($line -match "=")) { return }

  $k, $v = $line -split "=", 2
  $k = $k.Trim()
  $v = $v.Trim().Trim('"')
  [System.Environment]::SetEnvironmentVariable($k, $v, "Process")
}

Write-Host "Loaded .env into current PowerShell process."

# Pick STRANDA creds
$base        = if ($env:MEWS_BASE_URL_STRANDA) { $env:MEWS_BASE_URL_STRANDA } elseif ($env:MEWS_BASE_URL) { $env:MEWS_BASE_URL } else { "https://api.mews.com" }
$svc         = $env:MEWS_SERVICE_ID_STRANDA
$ent         = $env:MEWS_ENTERPRISE_ID_STRANDA
$access      = $env:MEWS_ACCESS_TOKEN_STRANDA
$clientToken = if ($env:MEWS_CLIENT_TOKEN_STRANDA) { $env:MEWS_CLIENT_TOKEN_STRANDA } else { $env:MEWS_CLIENT_TOKEN }
$clientName  = if ($env:MEWS_CLIENT_NAME) { $env:MEWS_CLIENT_NAME } else { "bno-api" }

if (-not $svc)         { throw "Missing MEWS_SERVICE_ID_STRANDA in .env" }
if (-not $ent)         { throw "Missing MEWS_ENTERPRISE_ID_STRANDA in .env" }
if (-not $access)      { throw "Missing MEWS_ACCESS_TOKEN_STRANDA in .env" }
if (-not $clientToken) { throw "Missing MEWS_CLIENT_TOKEN (and MEWS_CLIENT_TOKEN_STRANDA not set)" }

Write-Host "== Using =="
Write-Host "base=$base"
Write-Host "serviceId=$svc"
Write-Host "enterpriseId=$ent"
Write-Host "clientName=$clientName"
Write-Host "clientToken prefix=$($clientToken.Substring(0,6))..."
Write-Host "accessToken prefix=$($access.Substring(0,6))..."

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
      $text   = ""
      try {
        $sr = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $text = $sr.ReadToEnd()
      } catch {}
      Write-Host "HTTP $status $desc" -ForegroundColor Yellow
      if ($text) { Write-Host "BODY:`n$text" -ForegroundColor Yellow }
      return $null
    }
    throw
  }
}

# Get all rates
$ratesResp = Invoke-MewsPostJson "/api/connector/v1/rates/getAll" @{
  ClientToken   = $clientToken
  AccessToken   = $access
  Client        = $clientName
  EnterpriseIds = @($ent)
  ServiceIds    = @($svc)
  Limitation    = @{ Count = 1000 }
}

if (-not $ratesResp) { throw "rates/getAll returned null (see HTTP output above)." }

$rates = @()
if (Test-HasProp $ratesResp "Rates") { $rates = @($ratesResp.Rates) }

Write-Host ""
Write-Host "Rates returned: $($rates.Count)"

if ($rates.Count -gt 0) {
  Write-Host ""
  Write-Host "First rate properties (so we see the shape):"
  ($rates[0].PSObject.Properties.Name | Sort-Object) -join ", " | Out-Host
}

# Optional filters
if ($NameContains) {
  $rates = $rates | Where-Object {
    $n = $null
    try { $n = $_.Name } catch {}
    if (-not $n) {
      try { $n = $_.Names.'en-US' } catch {}
    }
    if (-not $n) { return $false }
    return ($n -like "*$NameContains*")
  }
}

if ($OnlyActive) {
  $rates = $rates | Where-Object {
    # Many tenants expose IsActive boolean
    $isActive = $false
    try { $isActive = [bool]$_.IsActive } catch { $isActive = $false }
    return $isActive
  }
}

$report = foreach ($r in $rates) {
  $name = $null
  try { $name = $r.Name } catch {}
  if (-not $name) {
    try { $name = $r.Names.'en-US' } catch {}
  }
  if (-not $name) { $name = $r.Id }

  $isActive = $null
  try { $isActive = [bool]$r.IsActive } catch {}

  [pscustomobject]@{
    RateId    = $r.Id
    Name      = $name
    State     = if ($null -ne $isActive) { "IsActive=$isActive" } else { "n/a" }
    ServiceId = $r.ServiceId
  }
}

Write-Host ""
Write-Host "=== STRANDA Rates (copy RateId) ==="
Write-Host ""

$report | Sort-Object Name | Format-Table -AutoSize

# Save JSON
$outPath = Join-Path $root "stranda-rates.json"
$ratesResp | ConvertTo-Json -Depth 20 | Out-File -Encoding UTF8 $outPath
Write-Host ""
Write-Host "Saved JSON: $outPath"
