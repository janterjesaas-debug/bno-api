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
  [string]$ServiceId,

  [Parameter(Mandatory = $false)]
  [string]$RateId,

  # beholdes for kompatibilitet (combined-quote sender dette)
  [Parameter(Mandatory = $false)]
  [ValidateSet('Agent','Customer')]
  [string]$PriceMode = 'Agent',

  # beholdes for kompatibilitet (combined-quote sender dette),
  # men TRYSIL skal alltid ha 0-fee i logikken under.
  [Parameter(Mandatory = $false)]
  [decimal]$FeePercent = 0,

  [Parameter(Mandatory = $false)]
  [decimal]$FeeFixedNok = 0,

  [Parameter(Mandatory = $false)]
  [decimal]$FeeVatPercent = 0,

  [Parameter(Mandatory = $false)]
  [ValidateSet('nb','en','sv','da','de','fr','es','it','nl')]
  [string]$Lang = 'nb',

  [switch]$ShowDescription,

  # DEBUG/TEST: inkluder rader selv om MinAvail = 0
  [switch]$IncludeSoldOut,

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

function Get-Prop {
  param($Obj, [string]$Name)
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
  } catch { return $null }
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

function Get-CategoryGrossTotal {
  param($CategoryPrice)
  if ($null -eq $CategoryPrice) { return $null }

  foreach ($n in @('GrossTotal','TotalGross','TotalGrossValue')) {
    $v = Get-Prop $CategoryPrice $n
    $d = ConvertTo-Decimal $v
    if ($null -ne $d) { return $d }
  }

  $amountPrices = Get-Prop $CategoryPrice 'AmountPrices'
  if ($amountPrices) {
    $sum = [decimal]0
    $any = $false
    foreach ($ap in $amountPrices) {
      $gv = Get-Prop $ap 'GrossValue'
      $d = ConvertTo-Decimal $gv
      if ($null -eq $d -and $gv) {
        $d = ConvertTo-Decimal (Get-Prop $gv 'Amount')
      }
      if ($null -ne $d) { $sum += $d; $any = $true }
    }
    if ($any) { return $sum }
  }

  $prices = Get-Prop $CategoryPrice 'Prices'
  if ($prices) {
    $sum = [decimal]0
    $any = $false
    foreach ($p in $prices) {
      $d = ConvertTo-Decimal $p
      if ($null -ne $d) { $sum += $d; $any = $true }
    }
    if ($any) { return $sum }
  }

  return $null
}

function Get-CategoryCurrency {
  param($CategoryPrice)
  if ($null -eq $CategoryPrice) { return $null }

  $amountPrices = Get-Prop $CategoryPrice 'AmountPrices'
  if ($amountPrices) {
    foreach ($ap in $amountPrices) {
      $cur = Get-Prop $ap 'Currency'
      if ($cur) { return [string]$cur }
      $gv = Get-Prop $ap 'GrossValue'
      if ($gv) {
        $cur2 = Get-Prop $gv 'Currency'
        if ($cur2) { return [string]$cur2 }
      }
    }
  }

  $cur3 = Get-Prop $CategoryPrice 'Currency'
  if ($cur3) { return [string]$cur3 }

  return $null
}

function Get-MinAvailByCat {
  param($AvailabilityObj)

  $map = @{}
  if ($null -eq $AvailabilityObj) { return $map }

  $ca = Get-Prop $AvailabilityObj 'CategoryAvailabilities'
  if ($ca) {
    foreach ($a in $ca) {
      $catId = [string](Get-Prop $a 'CategoryId')
      if (-not $catId) { continue }

      $vals = @()
      $arr = Get-Prop $a 'Availabilities'
      if ($arr) {
        foreach ($x in $arr) {
          $d = ConvertTo-Decimal $x
          if ($null -ne $d) { $vals += $d; continue }

          foreach ($f in @('AvailableUnits','AvailableUnitCount','Units','Count')) {
            $d2 = ConvertTo-Decimal (Get-Prop $x $f)
            if ($null -ne $d2) { $vals += $d2; break }
          }
        }
      }

      if ($vals.Count -gt 0) {
        $min = ($vals | Measure-Object -Minimum).Minimum
        $map[$catId] = [decimal]$min
      }
    }
    return $map
  }

  $rca = Get-Prop $AvailabilityObj 'ResourceCategoryAvailabilities'
  if ($rca) {
    foreach ($a in $rca) {
      $catId = [string](Get-Prop $a 'ResourceCategoryId')
      if (-not $catId) { continue }

      $vals = @()
      $arr = Get-Prop $a 'Availabilities'
      if ($arr) {
        foreach ($x in $arr) {
          $d = ConvertTo-Decimal $x
          if ($null -ne $d) { $vals += $d; continue }

          foreach ($f in @('AvailableUnits','AvailableUnitCount','Units','Count')) {
            $d2 = ConvertTo-Decimal (Get-Prop $x $f)
            if ($null -ne $d2) { $vals += $d2; break }
          }
        }
      }

      if ($vals.Count -gt 0) {
        $min = ($vals | Measure-Object -Minimum).Minimum
        $map[$catId] = [decimal]$min
      }
    }
  }

  return $map
}

# -----------------------------
# Resolve repo root + load .env
# -----------------------------
$scriptDir = $null
if ($PSScriptRoot -and $PSScriptRoot.Trim()) { $scriptDir = $PSScriptRoot }
elseif ($MyInvocation.MyCommand.Path) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }

$repoRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path

$dotenvPath = Join-Path $repoRoot '.env'
Import-DotEnv -Path $dotenvPath
Write-Host "Loaded .env into current PowerShell process."

if (-not $OutFile -or -not $OutFile.Trim()) {
  $OutFile = Join-Path $repoRoot 'trysil-quote.json'
}

# -----------------------------
# Config (TRYSIL/BNO)
# -----------------------------
$base = Get-EnvFirst @('MEWS_BASE_URL','MEWS_BASE','BASE_URL','API_BASE')
if (-not $base) { $base = 'https://api.mews.com' }

if (-not $ServiceId -or -not $ServiceId.Trim()) {
  $ServiceId = Get-EnvFirst @('MEWS_SERVICE_ID_TRYSIL_TURISTSENTER','MEWS_SERVICE_ID','SERVICE_ID')
}

$enterpriseId = Get-EnvFirst @('MEWS_ENTERPRISE_ID','ENTERPRISE_ID')
$clientName   = Get-EnvFirst @('MEWS_CLIENT_NAME','CLIENT_NAME')
if (-not $clientName) { $clientName = 'BNO Travel App 1.0' }

$clientToken  = Get-EnvFirst @('MEWS_CLIENT_TOKEN','CLIENT_TOKEN')
$accessToken  = Get-EnvFirst @('MEWS_ACCESS_TOKEN','ACCESS_TOKEN')

if (-not $ServiceId)    { throw "Missing ServiceId for Trysil" }
if (-not $enterpriseId) { throw "Missing MEWS_ENTERPRISE_ID" }
if (-not $clientToken)  { throw "Missing MEWS_CLIENT_TOKEN" }
if (-not $accessToken)  { throw "Missing MEWS_ACCESS_TOKEN" }

if (-not $RateId -or -not $RateId.Trim()) {
  $RateId = Get-EnvFirst @('MEWS_RATE_ID','RATE_ID')
}
if (-not $RateId) { throw "Missing -RateId (Trysil) and no env MEWS_RATE_ID/RATE_ID" }

$tzWindows = Get-EnvFirst @('TZ_WINDOWS','MEWS_TZ_WINDOWS')
if (-not $tzWindows) { $tzWindows = 'W. Europe Standard Time' }
$tz = [System.TimeZoneInfo]::FindSystemTimeZoneById($tzWindows)

Write-Host "== Using (TRYSIL/BNO) =="
Write-Host "base=$base"
Write-Host "serviceId=$ServiceId"
Write-Host "enterpriseId=$enterpriseId"
Write-Host "clientName=$clientName"
Write-Host "tzWindows=$tzWindows"
Write-Host ("clientToken prefix={0}..." -f ($clientToken.Substring(0,[Math]::Min(6,$clientToken.Length))))
Write-Host ("accessToken prefix={0}..." -f ($accessToken.Substring(0,[Math]::Min(6,$accessToken.Length))))
Write-Host ("RateId={0}" -f $RateId)
Write-Host ""

# -----------------------------
# Dates (UTC)
# -----------------------------
$checkInUtc  = ConvertFrom-YmdLocalMidnight -Ymd $CheckIn  -Tz $tz
$checkOutUtc = ConvertFrom-YmdLocalMidnight -Ymd $CheckOut -Tz $tz

$nights = [int]([Math]::Round(($checkOutUtc - $checkInUtc).TotalDays))
if ($nights -lt 1) { $nights = 1 }

$startUtcStr = Format-IsoUtc $checkInUtc
$endUtcStr   = Format-IsoUtc $checkOutUtc

Write-Host "Availability/pricing query:"
Write-Host "  checkin(from)=$CheckIn  checkout(to)=$CheckOut (exclusive)"
Write-Host "  nights=$nights"
Write-Host "  StartUtc=$startUtcStr"
Write-Host "  EndUtc  =$endUtcStr"
Write-Host ""

# TRYSIL: tving alltid fee=0 (uansett hva combined-quote sender)
$FeePercent = 0
$FeeFixedNok = 0
$FeeVatPercent = 0

Write-Host "Fee model:"
Write-Host "  (TRYSIL) FeePercent=0 FeeFixedNok=0 FeeVatPercent=0 (no fee on own inventory)"
Write-Host ""

$common = @{
  ClientToken = $clientToken
  AccessToken = $accessToken
  Client      = $clientName
}

# -----------------------------
# ResourceCategories (best effort)
# -----------------------------
$resourceCategoriesRaw = $null
$resourceCategoriesById = @{}

try {
  $rcResp = Invoke-MewsPost -Base $base -Path 'resourceCategories/getAll' -Body ($common + @{
    EnterpriseIds = @($enterpriseId)
    ServiceIds    = @($ServiceId)
  })

  $items = Get-Prop $rcResp 'ResourceCategories'
  if ($items) {
    $resourceCategoriesRaw = $rcResp
    foreach ($c in $items) {
      $id = [string](Get-Prop $c 'Id')
      if ($id) { $resourceCategoriesById[$id] = $c }
    }
    Write-Host ("Loaded ResourceCategories: {0}" -f $resourceCategoriesById.Count)
  } else {
    Write-Warning "Could not load ResourceCategories (no items)."
  }
} catch {
  Write-Warning "Could not load ResourceCategories (call failed)."
}
Write-Host ""

# -----------------------------
# Availability + Pricing
# -----------------------------
$availabilityReq = $common + @{
  ServiceId = $ServiceId
  StartUtc  = $startUtcStr
  EndUtc    = $endUtcStr
}
$availability = Invoke-MewsPost -Base $base -Path 'services/getAvailability' -Body $availabilityReq
$minAvailByCat = Get-MinAvailByCat -AvailabilityObj $availability

$pricingReq = $common + @{
  EnterpriseId = $enterpriseId
  ServiceId    = $ServiceId
  RateId       = $RateId
  StartUtc     = $startUtcStr
  EndUtc       = $endUtcStr
}
$pricing = Invoke-MewsPost -Base $base -Path 'rates/getPricing' -Body $pricingReq

$categoryPrices = Get-Prop $pricing 'CategoryPrices'
if (-not $categoryPrices) { throw "rates/getPricing response missing CategoryPrices (unexpected shape)." }

# -----------------------------
# Build report rows (NO FEE)
# -----------------------------
$rows = @()
$cpArray = @($categoryPrices)

foreach ($cp in $cpArray) {
  $catId = [string](Get-Prop $cp 'CategoryId')
  if (-not $catId) { $catId = [string](Get-Prop $cp 'ResourceCategoryId') }
  if (-not $catId) { continue }

  $minAvail = 0

  if ($minAvailByCat.ContainsKey($catId)) {
    $minAvail = [int]$minAvailByCat[$catId]
  } elseif ($minAvailByCat.Count -eq 1 -and $cpArray.Count -eq 1) {
    # Single-category fallback ved ID-mismatch mellom pricing/availability
    $only = ($minAvailByCat.GetEnumerator() | Select-Object -First 1)
    $minAvail = [int]$only.Value
    Write-Warning ("MinAvail fallback brukt (pricingCatId={0} availCatId={1} minAvail={2})" -f $catId, $only.Key, $minAvail)
  }

  if (-not $IncludeSoldOut) {
    if ($minAvail -le 0) { continue }
  }

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

  if (-not $shortName) { $shortName = $catId.Substring([Math]::Max(0, $catId.Length - 6)) }
  if (-not $name)      { $name = "Category $catId" }

  $customerTotal = [decimal]$lodgingTotal
  $supplierNet   = [decimal]$lodgingTotal

  $rows += [pscustomobject]@{
    ResourceCategoryId = $catId
    ShortName          = $shortName
    Name               = $name
    Capacity           = $capacity
    MinAvail           = [int]$minAvail
    LodgingTotal       = [decimal]([Math]::Round($lodgingTotal, 2))
    FeeExVat           = [decimal]0
    FeeVat             = [decimal]0
    FeeIncVat          = [decimal]0
    CustomerTotal      = [decimal]([Math]::Round($customerTotal, 2))
    SupplierNet        = [decimal]([Math]::Round($supplierNet, 2))
    Currency           = $currency
    BookingMode        = 'INTERNAL'
    BookingUrl         = ''
    FeePolicy          = 'NONE (own inventory)'
    Description        = $desc
  }
}

$rows = $rows | Sort-Object CustomerTotal

Write-Host "=== BOOKABLE (TRYSIL) ==="
Write-Host ""

if ($ShowDescription) {
  $rows | Select-Object ShortName, Name, Capacity, MinAvail, LodgingTotal, CustomerTotal, Currency, BookingMode, FeePolicy, Description |
    Format-Table -AutoSize
} else {
  $rows | Select-Object ShortName, Name, Capacity, MinAvail, LodgingTotal, CustomerTotal, Currency, BookingMode, FeePolicy |
    Format-Table -AutoSize
}

Write-Host ""
Write-Host ("Report rows: {0}" -f (@($rows).Count))

if (@($rows).Count -eq 0) {
  $availIds = @()
  if ($availability -and $availability.CategoryAvailabilities) {
    $availIds = @($availability.CategoryAvailabilities | ForEach-Object { [string]$_.CategoryId })
  } elseif ($availability -and $availability.ResourceCategoryAvailabilities) {
    $availIds = @($availability.ResourceCategoryAvailabilities | ForEach-Object { [string]$_.ResourceCategoryId })
  }

  $priceIds = @($cpArray | ForEach-Object { [string](Get-Prop $_ 'CategoryId') })

  Write-Warning ("Report ble tom. Debug: CategoryPrices={0} minAvailByCat={1} ResourceCategories={2}" -f $cpArray.Count, $minAvailByCat.Count, $resourceCategoriesById.Count)
  Write-Warning ("Pricing CategoryIds: {0}" -f (($priceIds | Where-Object { $_ } | Sort-Object) -join ", "))
  Write-Warning ("Availability CategoryIds: {0}" -f (($availIds | Where-Object { $_ } | Sort-Object) -join ", "))

  if ($minAvailByCat.Count -gt 0) {
    $only = ($minAvailByCat.GetEnumerator() | Select-Object -First 1)
    Write-Warning ("MinAvailByCat sample: {0} => {1}" -f $only.Key, $only.Value)
  }

  $firstA = $null
  if ($availability -and $availability.CategoryAvailabilities) {
    $firstA = @($availability.CategoryAvailabilities)[0]
  } elseif ($availability -and $availability.ResourceCategoryAvailabilities) {
    $firstA = @($availability.ResourceCategoryAvailabilities)[0]
  }
  if ($firstA) {
    Write-Warning ("First availability entry: " + ($firstA | ConvertTo-Json -Depth 10))
  }

  $firstP = $cpArray | Select-Object -First 1
  if ($firstP) {
    Write-Warning ("First pricing entry: " + ($firstP | ConvertTo-Json -Depth 10))
  }
}

$bundle = [pscustomobject]@{
  meta = [pscustomobject]@{
    CheckIn        = $CheckIn
    CheckOut       = $CheckOut
    Nights         = $nights
    ServiceId      = $ServiceId
    EnterpriseId   = $enterpriseId
    RateId         = $RateId
    PriceMode      = $PriceMode
    Lang           = $Lang
    IncludeSoldOut = [bool]$IncludeSoldOut
    GeneratedUtc   = (Get-Date).ToUniversalTime().ToString('o')
  }
  availability       = $availability
  pricing            = $pricing
  resourceCategories = $resourceCategoriesRaw
  report             = @($rows)   # alltid array
}

$bundle | ConvertTo-Json -Depth 80 | Set-Content -Path $OutFile -Encoding UTF8
Write-Host "Saved JSON: $OutFile"