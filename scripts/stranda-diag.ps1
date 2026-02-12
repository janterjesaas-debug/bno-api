#requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d{4}-\d{2}-\d{2}$')]
  [string]$CheckIn,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d{4}-\d{2}-\d{2}$')]
  [string]$CheckOut
)

Set-StrictMode -Version Latest

function Import-DotEnv {
  param([string]$Path)
  if (-not $Path) { return }
  if (-not (Test-Path -LiteralPath $Path)) { throw "Fant ikke .env på: $Path" }

  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line) { return }
    if ($line.StartsWith('#')) { return }

    $idx = $line.IndexOf('=')
    if ($idx -lt 1) { return }

    $k = $line.Substring(0, $idx).Trim()
    $v = $line.Substring($idx + 1).Trim()

    if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
      $v = $v.Substring(1, $v.Length - 2)
    }

    if ($k) { [Environment]::SetEnvironmentVariable($k, $v, 'Process') }
  }
}

function Get-Env([string]$Name) {
  $v = [Environment]::GetEnvironmentVariable($Name,'Process')
  if ($v -and $v.Trim()) { return $v.Trim() }
  return $null
}

function Prefix([string]$Value, [int]$N = 8) {
  if (-not $Value) { return '<missing>' }
  $len = [Math]::Min($N, $Value.Length)
  return ($Value.Substring(0, $len) + '...')
}

function Format-IsoUtc([datetime]$Dt) {
  return $Dt.ToUniversalTime().ToString("yyyy-MM-dd'T'HH':'mm':'ss'Z'", [System.Globalization.CultureInfo]::InvariantCulture)
}

$dotenvPath = Join-Path $PSScriptRoot '..\.env'
Import-DotEnv $dotenvPath
Write-Host "Imported .env into THIS PowerShell session."

$base = Get-Env 'MEWS_BASE_URL'
if (-not $base) { $base = 'https://api.mews.com' }
$base = $base.TrimEnd('/')

$clientToken = Get-Env 'MEWS_CLIENT_TOKEN'
$accessToken = Get-Env 'MEWS_ACCESS_TOKEN_STRANDA'
$serviceId   = Get-Env 'MEWS_SERVICE_ID_STRANDA'

Write-Host ("MEWS_BASE_URL => {0}" -f $base)
Write-Host ("MEWS_CLIENT_TOKEN => {0}" -f (Prefix $clientToken 8))
Write-Host ("MEWS_ACCESS_TOKEN_STRANDA => {0}" -f (Prefix $accessToken 8))
Write-Host ("MEWS_SERVICE_ID_STRANDA => {0}" -f $serviceId)
Write-Host ""

if (-not $clientToken) { throw "MEWS_CLIENT_TOKEN mangler" }
if (-not $accessToken) { throw "MEWS_ACCESS_TOKEN_STRANDA mangler" }
if (-not $serviceId)   { throw "MEWS_SERVICE_ID_STRANDA mangler" }

$tz = [TimeZoneInfo]::FindSystemTimeZoneById("W. Europe Standard Time")
$ci = [datetime]::ParseExact($CheckIn,  'yyyy-MM-dd', [System.Globalization.CultureInfo]::InvariantCulture)
$co = [datetime]::ParseExact($CheckOut, 'yyyy-MM-dd', [System.Globalization.CultureInfo]::InvariantCulture)

$ciLocal = [datetime]::SpecifyKind($ci, [DateTimeKind]::Unspecified)
$coLocal = [datetime]::SpecifyKind($co, [DateTimeKind]::Unspecified)

$startUtc = [TimeZoneInfo]::ConvertTimeToUtc($ciLocal, $tz)
$endUtc   = [TimeZoneInfo]::ConvertTimeToUtc($coLocal, $tz)

$uri = "$base/api/connector/v1/services/getAvailability"

$body = @{
  ClientToken = $clientToken
  AccessToken = $accessToken
  Client      = 'BNO diag'
  ServiceId   = $serviceId
  StartUtc    = (Format-IsoUtc $startUtc)
  EndUtc      = (Format-IsoUtc $endUtc)
}

Write-Host ("Calling: {0}" -f $uri)
Write-Host ("StartUtc={0} EndUtc={1}" -f $body.StartUtc, $body.EndUtc)
Write-Host ""

try {
  $resp = Invoke-RestMethod -Method Post -Uri $uri -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 20)
  $resp | Select-Object -First 1 | Format-List
  Write-Host "OK: services/getAvailability svarte."
} catch {
  $respObj = $_.Exception.Response
  if ($respObj -and $respObj.GetResponseStream()) {
    $sr = New-Object IO.StreamReader($respObj.GetResponseStream())
    $sr.ReadToEnd()
  } else {
    $_ | Format-List * -Force
  }
  throw
}
