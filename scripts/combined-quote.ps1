#requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d{4}-\d{2}-\d{2}$')]
  [string]$CheckIn,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d{4}-\d{2}-\d{2}$')]
  [string]$CheckOut,

  # Stranda RateId (valgfri hvis MEWS_RATE_ID_STRANDA finnes i .env)
  [Parameter(Mandatory = $false)]
  [string]$RateIdStranda,

  [Parameter(Mandatory = $false)]
  [ValidateSet('Agent','Customer')]
  [string]$PriceMode = 'Agent',

  [Parameter(Mandatory = $false)]
  [int]$Adults = 2,

  [Parameter(Mandatory = $false)]
  [decimal]$FeePercent = 10,

  [Parameter(Mandatory = $false)]
  [decimal]$FeeFixedNok = 25,

  [Parameter(Mandatory = $false)]
  [decimal]$FeeVatPercent = 25,

  [Parameter(Mandatory = $false)]
  [ValidateSet('nb','en','sv','da','de','fr','es','it','nl')]
  [string]$Lang = 'nb',

  # Hvis du vil se utsolgte interne også (MinAvail=0)
  [Parameter(Mandatory = $false)]
  [switch]$IncludeSoldOutInternal,

  # Outfil i repo root
  [Parameter(Mandatory = $false)]
  [string]$OutFile
)

function Import-DotEnv {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line) { return }
    if ($line.StartsWith('#')) { return }
    $idx = $line.IndexOf('=')
    if ($idx -lt 1) { return }
    $k = $line.Substring(0, $idx).Trim()
    $v = $line.Substring($idx + 1).Trim()

    # dropp inline kommentarer "KEY=VAL # comment" (best effort)
    if ($v -match '^(.*?)\s+#') { $v = $Matches[1].Trim() }

    if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
      $v = $v.Substring(1, $v.Length - 2)
    }
    if ($k) { [Environment]::SetEnvironmentVariable($k, $v, 'Process') }
  }
}

function Get-EnvFirst {
  param([string[]]$Names)
  foreach ($n in $Names) {
    $v = [Environment]::GetEnvironmentVariable($n, 'Process')
    if ($v -and $v.Trim().Length -gt 0) { return $v.Trim() }
  }
  return $null
}

function Invoke-PSFile {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][hashtable]$Parameters
  )

  $psArgList = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $Path
  )

  foreach ($k in $Parameters.Keys) {
    $v = $Parameters[$k]
    if ($v -is [switch] -or $v -is [bool]) {
      if ($v) { $psArgList += "-$k" }
    } else {
      if ($null -ne $v -and [string]$v -ne '') {
        $psArgList += "-$k"
        $psArgList += [string]$v
      }
    }
  }

  & powershell @psArgList
  if ($LASTEXITCODE -ne 0) {
    throw "Kjøring feilet: $Path (exit=$LASTEXITCODE)"
  }
}

function Get-MewsBookingUrl {
  param(
    [string]$DistributionBase,
    [string]$DistributionConfigurationId,
    [string]$From,
    [string]$To,
    [int]$Adults,
    [string]$Locale
  )
  if (-not $DistributionBase -or -not $DistributionConfigurationId) { return $null }

  $base = $DistributionBase.TrimEnd('/')
  $url  = "$base/$DistributionConfigurationId?from=$From&to=$To&adults=$Adults"
  if ($Locale) { $url += "&locale=$Locale" }
  return $url
}

# Resolve repo root robust
$scriptDir = $null
if ($PSScriptRoot -and $PSScriptRoot.Trim()) { $scriptDir = $PSScriptRoot }
elseif ($MyInvocation.MyCommand.Path) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }
$repoRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path

$dotenvPath = Join-Path $repoRoot '.env'
Import-DotEnv $dotenvPath
Write-Host "Loaded .env into THIS PowerShell process."

# **VIKTIG**: hold combined OutFile separat så vi ikke overstyrer den i loops
if (-not $OutFile -or -not $OutFile.Trim()) {
  $OutFile = Join-Path $repoRoot "combined-quote.json"
}
$combinedOutFile = $OutFile

# --- Resolve scripts ---
$strandaScript = Join-Path $repoRoot "scripts\stranda-quote.ps1"
$trysilScript  = Join-Path $repoRoot "scripts\trysil-quote.ps1"

if (-not (Test-Path $strandaScript)) { throw "Fant ikke $strandaScript" }
if (-not (Test-Path $trysilScript))  { throw "Fant ikke $trysilScript" }

# --- Defaults from .env ---
if (-not $RateIdStranda) { $RateIdStranda = Get-EnvFirst @('MEWS_RATE_ID_STRANDA') }
if (-not $RateIdStranda) { throw "Missing RateIdStranda (pass -RateIdStranda or set MEWS_RATE_ID_STRANDA in .env)" }

$distBase = Get-EnvFirst @('MEWS_DISTRIBUTOR_BASE')
$locale   = Get-EnvFirst @('MEWS_LOCALE')

# --- Run STRANDA quote -> stranda-quote.json ---
$strandaOut = Join-Path $repoRoot "stranda-quote.json"
Remove-Item $strandaOut -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=== Running STRANDA quote ==="
Invoke-PSFile -Path $strandaScript -Parameters @{
  CheckIn       = $CheckIn
  CheckOut      = $CheckOut
  RateId        = $RateIdStranda
  FeePercent    = $FeePercent
  FeeFixedNok   = $FeeFixedNok
  FeeVatPercent = $FeeVatPercent
  PriceMode     = $PriceMode
  Lang          = $Lang
  OutFile       = $strandaOut
}

# --- INTERNAL areas (Trysil/BNO) ---
$areas = @(
  @{ Key='TRYSIL_TURISTSENTER';       ServiceEnv='MEWS_SERVICE_ID_TRYSIL_TURISTSENTER';       RateEnv='MEWS_RATE_ID_TRYSIL_TURISTSENTER';       DistEnv='MEWS_DISTRIBUTION_CONFIGURATION_ID_TRYSIL_TURISTSENTER' },
  @{ Key='TRYSILFJELL_HYTTEOMRADE';   ServiceEnv='MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE';   RateEnv='MEWS_RATE_ID_TRYSILFJELL_HYTTEOMRADE';   DistEnv='MEWS_DISTRIBUTION_CONFIGURATION_ID_TRYSILFJELL_HYTTEOMRADE' },
  @{ Key='TRYSIL_HOYFJELLSSENTER';    ServiceEnv='MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER';    RateEnv='MEWS_RATE_ID_TRYSIL_HOYFJELLSSENTER';    DistEnv='MEWS_DISTRIBUTION_CONFIGURATION_ID_TRYSIL_HOYFJELLSSENTER' },

  @{ Key='TANDADALEN_SALEN';          ServiceEnv='MEWS_SERVICE_ID_TANDADALEN_SALEN';          RateEnv='MEWS_RATE_ID_TANDADALEN_SALEN';          DistEnv='MEWS_DISTRIBUTION_CONFIGURATION_ID_TANDADALEN_SALEN' },
  @{ Key='HOGFJALLET_SALEN';          ServiceEnv='MEWS_SERVICE_ID_HOGFJALLET_SALEN';          RateEnv='MEWS_RATE_ID_HOGFJALLET_SALEN';          DistEnv='MEWS_DISTRIBUTION_CONFIGURATION_ID_HOGFJALLET_SALEN' },
  @{ Key='LINDVALLEN_SALEN';          ServiceEnv='MEWS_SERVICE_ID_LINDVALLEN_SALEN';          RateEnv='MEWS_RATE_ID_LINDVALLEN_SALEN';          DistEnv='MEWS_DISTRIBUTION_CONFIGURATION_ID_LINDVALLEN_SALEN' }
)

$internalJsonFiles = @()

foreach ($a in $areas) {
  $serviceId = Get-EnvFirst @($a.ServiceEnv, 'MEWS_SERVICE_ID')
  $rateId    = Get-EnvFirst @($a.RateEnv, 'MEWS_RATE_ID')

  if (-not $serviceId -or -not $rateId) {
    Write-Host ""
    Write-Host ("=== Skipping INTERNAL area {0} (missing {1} or {2}) ===" -f $a.Key, $a.ServiceEnv, $a.RateEnv)
    continue
  }

  $areaOut = Join-Path $repoRoot ("internal-{0}.json" -f $a.Key)
  Remove-Item $areaOut -ErrorAction SilentlyContinue

  Write-Host ""
  Write-Host ("=== Running INTERNAL quote: {0} ===" -f $a.Key)

  $invokeParams = @{
    CheckIn       = $CheckIn
    CheckOut      = $CheckOut
    ServiceId     = $serviceId
    RateId        = $rateId
    FeePercent    = 0
    FeeFixedNok   = 0
    FeeVatPercent = 0
    PriceMode     = $PriceMode
    Lang          = $Lang
    OutFile       = $areaOut
  }
  if ($IncludeSoldOutInternal) { $invokeParams['IncludeSoldOut'] = $true }

  Invoke-PSFile -Path $trysilScript -Parameters $invokeParams
  $internalJsonFiles += $areaOut
}

# --- Merge ---
$jStranda = Get-Content $strandaOut -Raw | ConvertFrom-Json

$repS = @($jStranda.report)

# Source + AreaKey + Booking info for STRANDA
$repS2 = @()
foreach ($r in $repS) {
  $o = $r | Select-Object *
  Add-Member -InputObject $o -NotePropertyName Source -NotePropertyValue "STRANDA" -Force
  Add-Member -InputObject $o -NotePropertyName AreaKey -NotePropertyValue "STRANDA" -Force
  Add-Member -InputObject $o -NotePropertyName BookingMode -NotePropertyValue "EXTERNAL" -Force
  Add-Member -InputObject $o -NotePropertyName FeePolicy -NotePropertyValue ("{0}% + {1} NOK + {2}% VAT (fee only)" -f $FeePercent, $FeeFixedNok, $FeeVatPercent) -Force

  # (valgfritt) Hvis du senere legger inn MEWS_DISTRIBUTION_CONFIGURATION_ID_STRANDA i .env
  $strandaDist = Get-EnvFirst @('MEWS_DISTRIBUTION_CONFIGURATION_ID_STRANDA')
  $bu = Get-MewsBookingUrl -DistributionBase $distBase -DistributionConfigurationId $strandaDist -From $CheckIn -To $CheckOut -Adults $Adults -Locale $locale
  if ($bu) { Add-Member -InputObject $o -NotePropertyName BookingUrl -NotePropertyValue $bu -Force }
  else     { if (-not ($o.PSObject.Properties.Name -contains 'BookingUrl')) { Add-Member -InputObject $o -NotePropertyName BookingUrl -NotePropertyValue $null -Force } }

  $repS2 += $o
}

# INTERNAL reports
$repT2 = @()
foreach ($f in $internalJsonFiles) {
  $j = Get-Content $f -Raw | ConvertFrom-Json
  $rep = @($j.report)

  # Finn areaKey fra filnavn internal-<AREA>.json
  $bn = [IO.Path]::GetFileNameWithoutExtension($f)
  $areaKey = $bn.Substring("internal-".Length)

  # Booking URL (hvis distribution config finnes)
  $distEnv = $null
  foreach ($a in $areas) {
    if ($a.Key -eq $areaKey) { $distEnv = $a.DistEnv; break }
  }

  $distId = $null
  if ($distEnv) { $distId = Get-EnvFirst @($distEnv) }

  if (-not $distId) {
    Write-Warning ("Missing distribution config id for {0} ({1}). BookingUrl will be null." -f $areaKey, $distEnv)
  }

  $bookingUrl = Get-MewsBookingUrl -DistributionBase $distBase -DistributionConfigurationId $distId -From $CheckIn -To $CheckOut -Adults $Adults -Locale $locale

  foreach ($r in $rep) {
    $o = $r | Select-Object *
    Add-Member -InputObject $o -NotePropertyName Source -NotePropertyValue "TRYSIL" -Force
    Add-Member -InputObject $o -NotePropertyName AreaKey -NotePropertyValue $areaKey -Force
    Add-Member -InputObject $o -NotePropertyName BookingMode -NotePropertyValue "INTERNAL" -Force
    Add-Member -InputObject $o -NotePropertyName FeePolicy -NotePropertyValue "0 (own inventory)" -Force
    if ($bookingUrl) { Add-Member -InputObject $o -NotePropertyName BookingUrl -NotePropertyValue $bookingUrl -Force }
    else             { if (-not ($o.PSObject.Properties.Name -contains 'BookingUrl')) { Add-Member -InputObject $o -NotePropertyName BookingUrl -NotePropertyValue $null -Force } }

    $repT2 += $o
  }
}

$sourceMeta = @(
  [pscustomobject]@{ name="STRANDA"; reportCount=$repS2.Count; file="stranda-quote.json" }
  [pscustomobject]@{ name="TRYSIL";  reportCount=$repT2.Count; files=@($internalJsonFiles | ForEach-Object { [IO.Path]::GetFileName($_) }) }
)

$merged = [pscustomobject]@{
  meta = [pscustomobject]@{
    CheckIn      = $CheckIn
    CheckOut     = $CheckOut
    GeneratedUtc = (Get-Date).ToUniversalTime().ToString('o')
    PriceMode    = $PriceMode
    Adults       = $Adults
    FeePercent   = $FeePercent
    FeeFixedNok  = $FeeFixedNok
    FeeVatPercent= $FeeVatPercent
    Lang         = $Lang
    IncludeSoldOutInternal = [bool]$IncludeSoldOutInternal
  }
  sources = $sourceMeta
  report = @($repS2 + $repT2) | Sort-Object CustomerTotal
  raw = [pscustomobject]@{
    stranda = $jStranda
    internalFiles = $internalJsonFiles
  }
}

$merged | ConvertTo-Json -Depth 80 | Set-Content -Path $combinedOutFile -Encoding UTF8

Write-Host ""
Write-Host ("Saved combined JSON: {0}" -f $combinedOutFile)
Write-Host ("Combined report rows: {0}" -f (@($merged.report).Count))

$cntStranda = (@($merged.report) | Where-Object { $_.Source -eq 'STRANDA' }).Count
$cntTrysil  = (@($merged.report) | Where-Object { $_.Source -eq 'TRYSIL'  }).Count
Write-Host ("By source: STRANDA={0}" -f $cntStranda)
Write-Host ("By source: TRYSIL={0}" -f $cntTrysil)