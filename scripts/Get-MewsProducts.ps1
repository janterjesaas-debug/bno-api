param(
  [Parameter(Mandatory=$true)]
  [string]$ServiceId,

  [Parameter(Mandatory=$false)]
  [string]$Filter = ""
)

function Get-EnvOrDefault([string]$name, [string]$def) {
  $v = [Environment]::GetEnvironmentVariable($name, "Process")
  if ([string]::IsNullOrWhiteSpace($v)) { return $def }
  return $v.Trim()
}

$MEWS_BASE_URL     = (Get-EnvOrDefault "MEWS_BASE_URL" "https://api.mews.com").Trim().TrimEnd("/")
$MEWS_CLIENT_NAME  = (Get-EnvOrDefault "MEWS_CLIENT_NAME" "BNO Travel App 1.0").Trim()
$MEWS_CLIENT_TOKEN = (Get-EnvOrDefault "MEWS_CLIENT_TOKEN" "").Trim()
$MEWS_ACCESS_TOKEN = (Get-EnvOrDefault "MEWS_ACCESS_TOKEN" "").Trim()

if ([string]::IsNullOrWhiteSpace($MEWS_CLIENT_TOKEN) -or [string]::IsNullOrWhiteSpace($MEWS_ACCESS_TOKEN)) {
  throw "Mangler MEWS_CLIENT_TOKEN / MEWS_ACCESS_TOKEN i miljøvariabler (eller .env lastet inn i session)."
}

$uri = "$MEWS_BASE_URL/api/connector/v1/products/getAll"
Write-Host "Henter produkter fra Mews... $uri"
Write-Host "ServiceId: $ServiceId"
Write-Host "Filter: $Filter"
Write-Host ""

$body = @{
  ClientToken = $MEWS_CLIENT_TOKEN
  AccessToken = $MEWS_ACCESS_TOKEN
  Client      = $MEWS_CLIENT_NAME
  ServiceIds  = @($ServiceId)
  Limitation  = @{ Count = 1000 }
}

$r = Invoke-RestMethod -Method Post -Uri $uri -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 10)
$items = @()
if ($r -and $r.Products) { $items = $r.Products }

# Map Name (lokaliserte navn) til en streng
$rows = $items | ForEach-Object {
  $name = ""
  if ($_.Name -is [string]) { $name = $_.Name }
  elseif ($_.Name -ne $null) {
    $keys = $_.Name.PSObject.Properties.Name
    if ($keys -and $keys.Count -gt 0) { $name = [string]$_.Name.$($keys[0]) }
  }
  [PSCustomObject]@{
    Id        = $_.Id
    Name      = $name
    ServiceId = $ServiceId
  }
}

if ($Filter) {
  $regex = [regex]::new($Filter, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  $rows = $rows | Where-Object { $regex.IsMatch($_.Name) }
}

$rows | Sort-Object Name | Format-Table -AutoSize

Write-Host ""
Write-Host "Tips: Kopier ProductId-ene til MEWS_LINEN_PRODUCT_IDS i .env (komma-separert)."
