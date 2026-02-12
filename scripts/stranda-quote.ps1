#requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d{4}-\d{2}-\d{2}$')]
  [string]$CheckIn,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d{4}-\d{2}-\d{2}$')]
  [string]$CheckOut,

  [Parameter(Mandatory = $false)]
  [string]$RateId,

  [Parameter(Mandatory = $false)]
  [ValidateSet('Agent','Customer')]
  [string]$PriceMode = 'Agent',

  [Parameter(Mandatory = $false)]
  [decimal]$FeePercent = 10,

  [Parameter(Mandatory = $false)]
  [decimal]$FeeFixedNok = 25,

  [Parameter(Mandatory = $false)]
  [decimal]$FeeVatPercent = 25,

  [Parameter(Mandatory = $false)]
  [ValidateSet('nb','en','sv','da','de','fr','es','it','nl')]
  [string]$Lang = 'nb',

  [switch]$ShowDescription,

  # Ingen default som kan krasje pga $PSScriptRoot
  [Parameter(Mandatory = $false)]
  [string]$OutFile
)

# -----------------------------
# Helpers
# -----------------------------

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

function Get-Prop {
  param(
    [Parameter(Mandatory = $true)]$Obj,
    [Parameter(Mandatory = $true)][string]$Name
  )
  if ($null -eq $Obj) { return $null }
  $p = $Obj.PSObject.Properties[$Name]
  if ($null -eq $p) { return $null }
  return $p.Value
}

function ConvertTo-Decimal {
  param($Value)
  if ($null -eq $Value) { return $null }
  try {
    if ($Value -is [decimal]) { return $Value }
    if ($Value -is [double] -or $Value -is [float]) { return [decimal]$Value }
    if ($Value -is [int] -or $Value -is [long]) { return [decimal]$Value }
    if ($Value -is [string]) {
      $s = $Value.Trim()
      if (-not $s) { return $null }
      return [decimal]::Parse($s, [System.Globalization.CultureInfo]::InvariantCulture)
    }
    return [decimal]$Value
  } catch {
    return $null
  }
}

# NEW: håndter "money object" { Amount, Currency } og lignende
function Get-MoneyAmount {
  param($Value)

  # direkte tall/streng
  $d = ConvertTo-Decimal $Value
  if ($null -ne $d) { return $d }

  if ($null -eq $Value) { return $null }

  # objekt med Amount
  $amt = Get-Prop $Value 'Amount'
  $d2 = ConvertTo-Decimal $amt
  if ($null -ne $d2) { return $d2 }

  # objekt med GrossValue { Amount, Currency }
  $gv = Get-Prop $Value 'GrossValue'
  if ($gv) {
    $amt2 = Get-Prop $gv 'Amount'
    $d3 = ConvertTo-Decimal $amt2
    if ($null -ne $d3) { return $d3 }
  }

  # objekt med Value
  $val = Get-Prop $Value 'Value'
  $d4 = ConvertTo-Decimal $val
  if ($null -ne $d4) { return $d4 }

  return $null
}

function Get-MoneyCurrency {
  param($Value)
  if ($null -eq $Value) { return $null }

  $cur = Get-Prop $Value 'Currency'
  if ($cur) { return [string]$cur }

  $gv = Get-Prop $Value 'GrossValue'
  if ($gv) {
    $cur2 = Get-Prop $gv 'Currency'
    if ($cur2) { return [string]$cur2 }
  }

  return $null
}

function ConvertFrom-YmdLocalMidnight {
  param(
    [Parameter(Mandatory = $true)][string]$Ymd,
    [Parameter(Mandatory = $true)][System.TimeZoneInfo]$Tz
  )
  $dt = [datetime]::ParseExact($Ymd, 'yyyy-MM-dd', [System.Globalization.CultureInfo]::InvariantCulture)
  $local = [datetime]::SpecifyKind($dt, [System.DateTimeKind]::Unspecified)
  return [System.TimeZoneInfo]::ConvertTimeToUtc($local, $Tz)
}

function Format-IsoUtc {
  param([datetime]$Dt)
  return $Dt.ToUniversalTime().ToString("yyyy-MM-ddTHH\:mm\:ssZ", [System.Globalization.CultureInfo]::InvariantCulture)
}

function Invoke-MewsPost {
  param(
    [Parameter(Mandatory = $true)][string]$Base,
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][hashtable]$Body
  )

  $uri = ($Base.TrimEnd('/') + '/api/connector/v1/' + $Path.TrimStart('/'))
  $json = $Body | ConvertTo-Json -Depth 50

  try {
    return Invoke-RestMethod -Method Post -Uri $uri -ContentType 'application/json' -Body $json -TimeoutSec 60
  } catch {
    $status = $null
    $respBody = $null
    try {
      $resp = $_.Exception.Response
      if ($null -ne $resp) {
        $status = [int]$resp.StatusCode
        $stream = $resp.GetResponseStream()
        if ($null -ne $stream) {
          $reader = New-Object System.IO.StreamReader($stream)
          $respBody = $reader.ReadToEnd()
          $reader.Close()
        }
      }
    } catch {}

    if ($null -ne $status) {
      Write-Warning ("HTTP {0} on {1}" -f $status, $Path)
      if ($respBody) { Write-Warning ("Response body: " + ($respBody | Out-String).Trim()) }
    }
    throw
  }
}

function Get-LocalizedText {
  param($Obj, [string]$PreferLang)
  if ($null -eq $Obj) { return '' }

  foreach ($name in @('Description','Name','ShortName')) {
    $v = Get-Prop $Obj $name
    if ($v -is [string] -and $v.Trim()) { return $v.Trim() }
  }

  foreach ($mapName in @('Descriptions','Names','ExternalNames')) {
    $m = Get-Prop $Obj $mapName
    if ($m) {
      try {
        if ($m.ContainsKey($PreferLang) -and $m[$PreferLang]) { return [string]$m[$PreferLang] }
        if ($m.ContainsKey('en') -and $m['en']) { return [string]$m['en'] }
        foreach ($k in $m.Keys) { if ($m[$k]) { return [string]$m[$k] } }
      } catch {}
    }
  }

  return ''
}

# UPDATED: støtte for money objects på toppfelter + flere "pris-lister"
function Get-CategoryGrossTotal {
  param($CategoryPrice)
  if ($null -eq $CategoryPrice) { return $null }

  # 1) toppfelter (kan være tall eller money object)
  foreach ($n in @('GrossTotal','TotalGross','TotalGrossValue','GrossValue','TotalGrossAmount')) {
    $v = Get-Prop $CategoryPrice $n
    $d = Get-MoneyAmount $v
    if ($null -ne $d) { return $d }
  }

  # 2) AmountPrices / BaseAmountPrices (sum)
  foreach ($listName in @('AmountPrices','BaseAmountPrices')) {
    $list = Get-Prop $CategoryPrice $listName
    if ($list) {
      $sum = [decimal]0
      $any = $false
      foreach ($ap in $list) {
        # GrossValue.Amount
        $gv = Get-Prop $ap 'GrossValue'
        $d = $null
        if ($gv) { $d = Get-MoneyAmount $gv }
        if ($null -eq $d) {
          # evt direkte Gross/Amount
          $d = Get-MoneyAmount (Get-Prop $ap 'Gross')
          if ($null -eq $d) { $d = Get-MoneyAmount (Get-Prop $ap 'Amount') }
        }
        if ($null -ne $d) { $sum += $d; $any = $true }
      }
      if ($any) { return $sum }
    }
  }

  # 3) TimeUnitPrices / BasePrices (sum)
  foreach ($listName in @('TimeUnitPrices','BasePrices','Prices')) {
    $list = Get-Prop $CategoryPrice $listName
    if ($list) {
      $sum = [decimal]0
      $any = $false
      foreach ($tp in $list) {
        $d = Get-MoneyAmount $tp
        if ($null -eq $d) { $d = Get-MoneyAmount (Get-Prop $tp 'GrossValue') }
        if ($null -eq $d) { $d = Get-MoneyAmount (Get-Prop $tp 'Amount') }
        if ($null -ne $d) { $sum += $d; $any = $true }
      }
      if ($any) { return $sum }
    }
  }

  return $null
}

function Get-CategoryCurrency {
  param($CategoryPrice)
  if ($null -eq $CategoryPrice) { return $null }

  foreach ($n in @('TotalGrossValue','GrossValue','Currency')) {
    $v = Get-Prop $CategoryPrice $n
    $c = Get-MoneyCurrency $v
    if ($c) { return $c }
    if ($v -is [string] -and $v) { return [string]$v }
  }

  foreach ($listName in @('AmountPrices','BaseAmountPrices','TimeUnitPrices','BasePrices')) {
    $list = Get-Prop $CategoryPrice $listName
    if ($list) {
      foreach ($x in $list) {
        $c = Get-MoneyCurrency $x
        if ($c) { return $c }
        $gv = Get-Prop $x 'GrossValue'
        $c2 = Get-MoneyCurrency $gv
        if ($c2) { return $c2 }
      }
    }
  }

  return $null
}

function Invoke-LoadResourceCategories {
  param([hashtable]$Req)
  try { return Invoke-MewsPost -Base $base -Path 'resourceCategories/getAll' -Body $Req }
  catch { return $null }
}

function Get-MinAvailByCategory {
  param($AvailabilityResponse)
  $result = @{}

  $arr = Get-Prop $AvailabilityResponse 'CategoryAvailabilities'
  if (-not $arr) { $arr = Get-Prop $AvailabilityResponse 'ResourceCategoryAvailabilities' }
  if (-not $arr) { return $result }

  foreach ($a in $arr) {
    $catId = [string](Get-Prop $a 'CategoryId')
    if (-not $catId) { $catId = [string](Get-Prop $a 'ResourceCategoryId') }
    if (-not $catId) { continue }

    $vals = New-Object System.Collections.Generic.List[decimal]

    $av = Get-Prop $a 'Availabilities'
    if ($av) {
      foreach ($x in $av) {
        $d = ConvertTo-Decimal $x
        if ($null -ne $d) { $vals.Add($d); continue }

        foreach ($f in @('AvailableUnits','AvailableUnitCount','Units','Count','Value')) {
          $d2 = ConvertTo-Decimal (Get-Prop $x $f)
          if ($null -ne $d2) { $vals.Add($d2); break }
        }
      }
    }

    if ($vals.Count -eq 0) {
      foreach ($f in @('AvailableUnits','AvailableUnitCount','Units','Count','Value')) {
        $d3 = ConvertTo-Decimal (Get-Prop $a $f)
        if ($null -ne $d3) { $vals.Add($d3); break }
      }
    }

    if ($vals.Count -gt 0) {
      $min = ($vals | Measure-Object -Minimum).Minimum
      $result[$catId] = [decimal]$min
    }
  }

  return $result
}

# -----------------------------
# Resolve paths robustly
# -----------------------------
$scriptDir = $null
if ($PSScriptRoot -and $PSScriptRoot.Trim().Length -gt 0) {
  $scriptDir = $PSScriptRoot
} elseif ($MyInvocation.MyCommand.Path) {
  $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }

$repoRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
$dotenvPath = Join-Path $repoRoot '.env'

if (-not $OutFile -or $OutFile.Trim().Length -eq 0) {
  $OutFile = Join-Path $repoRoot 'stranda-quote.json'
}

# -----------------------------
# Load env + config
# -----------------------------
Import-DotEnv -Path $dotenvPath
Write-Host "Loaded .env into current PowerShell process."

$base = Get-EnvFirst @('MEWS_BASE_URL_STRANDA','MEWS_BASE_URL','MEWS_BASE','BASE_URL','API_BASE')
if (-not $base) { $base = 'https://api.mews.com' }

$serviceId    = Get-EnvFirst @('MEWS_SERVICE_ID_STRANDA')
$enterpriseId = Get-EnvFirst @('MEWS_ENTERPRISE_ID_STRANDA')

$clientName  = Get-EnvFirst @('MEWS_CLIENT_NAME','CLIENT_NAME')
if (-not $clientName) { $clientName = 'BNO Travel App 1.0' }

$clientToken = Get-EnvFirst @('MEWS_CLIENT_TOKEN','CLIENT_TOKEN')
$accessToken = Get-EnvFirst @('MEWS_ACCESS_TOKEN_STRANDA')

if (-not $serviceId)    { throw "Missing MEWS_SERVICE_ID_STRANDA in .env" }
if (-not $enterpriseId) { throw "Missing MEWS_ENTERPRISE_ID_STRANDA in .env" }
if (-not $clientToken)  { throw "Missing MEWS_CLIENT_TOKEN in .env" }
if (-not $accessToken)  { throw "Missing MEWS_ACCESS_TOKEN_STRANDA in .env" }

$tzWindows = Get-EnvFirst @('TZ_WINDOWS','MEWS_TZ_WINDOWS')
if (-not $tzWindows) { $tzWindows = 'W. Europe Standard Time' }
$tz = [System.TimeZoneInfo]::FindSystemTimeZoneById($tzWindows)

Write-Host "== Using (STRANDA) =="
Write-Host "base=$base"
Write-Host "serviceId=$serviceId"
Write-Host "enterpriseId=$enterpriseId"
Write-Host "clientName=$clientName"
Write-Host "tzWindows=$tzWindows"
Write-Host ("clientToken prefix={0}..." -f ($clientToken.Substring(0,[Math]::Min(6,$clientToken.Length))))
Write-Host ("accessToken prefix={0}..." -f ($accessToken.Substring(0,[Math]::Min(6,$accessToken.Length))))
Write-Host ""

# -----------------------------
# Dates
# -----------------------------
$checkInUtc  = ConvertFrom-YmdLocalMidnight -Ymd $CheckIn  -Tz $tz
$checkOutUtc = ConvertFrom-YmdLocalMidnight -Ymd $CheckOut -Tz $tz

$nights = [int]([Math]::Round(($checkOutUtc - $checkInUtc).TotalDays))
if ($nights -lt 1) { $nights = 1 }

$startUtc = Format-IsoUtc $checkInUtc
$endUtc   = Format-IsoUtc $checkOutUtc

$firstTimeUnitStartUtc = $checkInUtc
$lastTimeUnitStartUtc  = $checkInUtc.AddDays([Math]::Max(0, $nights - 1))

Write-Host "Availability/pricing query:"
Write-Host "  checkin(from)=$CheckIn  checkout(to)=$CheckOut (exclusive)"
Write-Host "  nights=$nights (pricing time units)"
Write-Host ("  FirstTimeUnitStartUtc={0}" -f (Format-IsoUtc $firstTimeUnitStartUtc))
Write-Host ("  LastTimeUnitStartUtc ={0}" -f (Format-IsoUtc $lastTimeUnitStartUtc))
Write-Host ""

Write-Host "Fee model (formidler):"
Write-Host ("  FeePercent={0} % of lodging" -f $FeePercent)
Write-Host ("  FeeFixedNok={0} NOK (ex VAT) per booking" -f $FeeFixedNok)
Write-Host ("  FeeVatPercent={0} % (applies only to fee)" -f $FeeVatPercent)
Write-Host ("  PriceMode={0}  ({1})" -f $PriceMode, ($(if ($PriceMode -eq 'Agent') { 'Agent => CustomerTotal == Mews total' } else { 'Customer => CustomerTotal == Mews total + fee' })))
Write-Host ""

$common = @{
  ClientToken = $clientToken
  AccessToken = $accessToken
  Client      = $clientName
}

# -----------------------------
# ResourceCategories (best-effort)
# -----------------------------
$resourceCategoriesRaw = $null
$resourceCategoriesById = @{}

$rcResp = Invoke-LoadResourceCategories -Req ($common + @{ EnterpriseIds = @($enterpriseId); ServiceIds = @($serviceId) })
if ($null -eq $rcResp) { $rcResp = Invoke-LoadResourceCategories -Req ($common + @{ ServiceIds = @($serviceId) }) }
if ($null -eq $rcResp) { $rcResp = Invoke-LoadResourceCategories -Req ($common + @{ EnterpriseIds = @($enterpriseId) }) }

$items = $null
if ($null -ne $rcResp) { $items = Get-Prop $rcResp 'ResourceCategories' }

if ($items) {
  $resourceCategoriesRaw = $rcResp
  foreach ($c in $items) {
    $id = [string](Get-Prop $c 'Id')
    if ($id) { $resourceCategoriesById[$id] = $c }
  }
  Write-Host ("Loaded ResourceCategories: {0}" -f $resourceCategoriesById.Count)
} else {
  Write-Warning "Could not load ResourceCategories (no names/descriptions)."
}
Write-Host ""

# -----------------------------
# RateId
# -----------------------------
if (-not $RateId) {
  $RateId = Get-EnvFirst @('MEWS_RATE_ID_STRANDA','MEWS_STRANDA_RATE_ID')
}
if (-not $RateId) {
  throw "Missing -RateId and no env MEWS_RATE_ID_STRANDA."
}
Write-Host "Using RateId=$RateId"
Write-Host ""

# -----------------------------
# Availability
# -----------------------------
$availabilityReq = $common + @{
  ServiceId = $serviceId
  StartUtc  = $startUtc
  EndUtc    = $endUtc
}
$availability = Invoke-MewsPost -Base $base -Path 'services/getAvailability' -Body $availabilityReq
$minAvailByCat = Get-MinAvailByCategory -AvailabilityResponse $availability

# -----------------------------
# Pricing
# -----------------------------
$pricingReq = $common + @{
  EnterpriseId = $enterpriseId
  ServiceId    = $serviceId
  RateId       = $RateId
  StartUtc     = $startUtc
  EndUtc       = $endUtc
}
$pricing = Invoke-MewsPost -Base $base -Path 'rates/getPricing' -Body $pricingReq

$categoryPrices = Get-Prop $pricing 'CategoryPrices'
if (-not $categoryPrices) { throw "rates/getPricing response missing CategoryPrices." }

# -----------------------------
# Build report
# -----------------------------
$rows = @()

foreach ($cp in $categoryPrices) {
  $catId = [string](Get-Prop $cp 'CategoryId')
  if (-not $catId) { $catId = [string](Get-Prop $cp 'ResourceCategoryId') }
  if (-not $catId) { continue }

  $minAvail = [decimal]0
  if ($minAvailByCat.ContainsKey($catId)) { $minAvail = $minAvailByCat[$catId] }
  if ($minAvail -le 0) { continue }

  $lodgingTotal = Get-CategoryGrossTotal -CategoryPrice $cp
  if ($null -eq $lodgingTotal) { continue }

  $currency = Get-CategoryCurrency -CategoryPrice $cp
  if (-not $currency) { $currency = 'NOK' }

  $meta = $null
  if ($resourceCategoriesById.ContainsKey($catId)) { $meta = $resourceCategoriesById[$catId] }

  $shortName = ''
  $name = ''
  $desc = ''
  $capacity = $null

  if ($null -ne $meta) {
    $shortName = [string](Get-Prop $meta 'ShortName')
    if (-not $shortName) { $shortName = '' }

    $name = Get-LocalizedText -Obj $meta -PreferLang $Lang
    if (-not $name) { $name = [string](Get-Prop $meta 'Name') }
    if (-not $name) { $name = '' }

    if ($ShowDescription) {
      $d = Get-Prop $meta 'Descriptions'
      if ($d) {
        try {
          if ($d.ContainsKey($Lang) -and $d[$Lang]) { $desc = [string]$d[$Lang] }
          elseif ($d.ContainsKey('en') -and $d['en']) { $desc = [string]$d['en'] }
          else { foreach ($k in $d.Keys) { if ($d[$k]) { $desc = [string]$d[$k]; break } } }
        } catch {}
      }
      if (-not $desc) { $desc = [string](Get-Prop $meta 'Description') }
      if (-not $desc) { $desc = '' }
    }

    $cap = ConvertTo-Decimal (Get-Prop $meta 'Capacity')
    if ($null -eq $cap) { $cap = ConvertTo-Decimal (Get-Prop $meta 'MaxPersons') }
    $capacity = $cap
  }

  $feeExVat = [decimal]0
  if ($FeePercent -gt 0) { $feeExVat += ($lodgingTotal * ($FeePercent / 100)) }
  if ($FeeFixedNok -gt 0) { $feeExVat += $FeeFixedNok }

  $feeVat = [decimal]0
  if ($FeeVatPercent -gt 0) { $feeVat = $feeExVat * ($FeeVatPercent / 100) }
  $feeIncVat = $feeExVat + $feeVat

  if ($PriceMode -eq 'Agent') {
    $customerTotal = $lodgingTotal
    $supplierNet = $lodgingTotal - $feeIncVat
  } else {
    $customerTotal = $lodgingTotal + $feeIncVat
    $supplierNet = $lodgingTotal
  }

  $rows += [pscustomobject]@{
    ResourceCategoryId = $catId
    ShortName          = $shortName
    Name               = $name
    Capacity           = $capacity
    MinAvail           = [int]$minAvail
    LodgingTotal       = [decimal]([Math]::Round($lodgingTotal, 2))
    FeeExVat           = [decimal]([Math]::Round($feeExVat, 2))
    FeeVat             = [decimal]([Math]::Round($feeVat, 2))
    FeeIncVat          = [decimal]([Math]::Round($feeIncVat, 2))
    CustomerTotal      = [decimal]([Math]::Round($customerTotal, 2))
    SupplierNet        = [decimal]([Math]::Round($supplierNet, 2))
    Currency           = $currency
    Description        = $desc
  }
}

# IMPORTANT: behold array selv om tom
$rows = @($rows | Sort-Object CustomerTotal)

Write-Host "=== BOOKABLE + Lodging + BNO Fee (VAT only on fee) ==="
Write-Host ""

if ($rows.Count -eq 0) {
  Write-Warning "Report ble tom. Debug: CategoryPrices=$($categoryPrices.Count) minAvailByCat=$($minAvailByCat.Count)"

  # Ekstra debug: vis 1 eksempel på felter i CategoryPrice
  $sample = $categoryPrices | Select-Object -First 1
  Write-Host ""
  Write-Host "DEBUG: First CategoryPrice keys:"
  Write-Host (($sample.PSObject.Properties.Name) -join ", ")
  Write-Host ""
  Write-Host "DEBUG: First CategoryPrice JSON:"
  Write-Host ($sample | ConvertTo-Json -Depth 20)
} elseif ($ShowDescription) {
  $rows | Select-Object ShortName, Name, Capacity, MinAvail, LodgingTotal, FeeExVat, FeeVat, FeeIncVat, CustomerTotal, SupplierNet, Currency, Description |
    Format-Table -AutoSize
} else {
  $rows | Select-Object ShortName, Name, Capacity, MinAvail, LodgingTotal, FeeExVat, FeeVat, FeeIncVat, CustomerTotal, SupplierNet, Currency |
    Format-Table -AutoSize
}

Write-Host ""

$bundle = [pscustomobject]@{
  meta = @{
    CheckIn       = $CheckIn
    CheckOut      = $CheckOut
    Nights        = $nights
    ServiceId     = $serviceId
    EnterpriseId  = $enterpriseId
    RateId        = $RateId
    PriceMode     = $PriceMode
    FeePercent    = $FeePercent
    FeeFixedNok   = $FeeFixedNok
    FeeVatPercent = $FeeVatPercent
    Lang          = $Lang
    GeneratedUtc  = (Get-Date).ToUniversalTime().ToString('o')
  }
  availability       = $availability
  pricing            = $pricing
  resourceCategories = $resourceCategoriesRaw
  report             = $rows
}

$bundle | ConvertTo-Json -Depth 80 | Set-Content -Path $OutFile -Encoding UTF8
Write-Host "Saved JSON: $OutFile"
