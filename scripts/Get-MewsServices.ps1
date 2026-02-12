# Get-MewsServices.ps1
# Kjør: cd C:\Users\jante\bno-api ; .\scripts\Get-MewsServices.ps1
# Leser .env i repo-root og lister alle Services (Id + navn)

$envPath = Join-Path (Get-Location) ".env"
if (!(Test-Path $envPath)) {
  throw "Fant ikke .env i $(Get-Location). Gå til bno-api-mappa først."
}

Get-Content $envPath | ForEach-Object {
  $line = $_.Trim()
  if ($line -eq "" -or $line.StartsWith("#")) { return }
  $parts = $line.Split("=", 2)
  if ($parts.Count -ne 2) { return }
  $k = $parts[0].Trim()
  $v = $parts[1].Trim().Trim('"')
  [System.Environment]::SetEnvironmentVariable($k, $v)
}

$baseUrl     = $env:MEWS_BASE_URL
$clientToken = $env:MEWS_CLIENT_TOKEN
$accessToken = $env:MEWS_ACCESS_TOKEN
$clientName  = $env:MEWS_CLIENT_NAME
$enterprise  = $env:MEWS_ENTERPRISE_ID
$locale      = $env:MEWS_LOCALE

if (!$baseUrl -or !$clientToken -or !$accessToken -or !$enterprise) {
  throw "Mangler MEWS_BASE_URL / MEWS_CLIENT_TOKEN / MEWS_ACCESS_TOKEN / MEWS_ENTERPRISE_ID i .env"
}
if (!$clientName) { $clientName = "bno-api" }
if (!$locale) { $locale = "en-US" }

$uri = ($baseUrl.TrimEnd("/")) + "/api/connector/v1/services/getAll"

$body = @{
  ClientToken   = $clientToken.Trim()
  AccessToken   = $accessToken.Trim()
  Client        = $clientName
  EnterpriseIds = @($enterprise)
  Limitation    = @{ Count = 1000 }
} | ConvertTo-Json -Depth 10

Write-Host "Henter services fra Mews..." $uri
$response = Invoke-RestMethod -Method Post -Uri $uri -ContentType "application/json" -Body $body

$services = $response.Services
if (!$services) { $services = @() }

Write-Host ""
Write-Host ("Fant {0} service(r)" -f $services.Count)
Write-Host ""

$services | ForEach-Object {
  $names = $_.Names
  $name  = $null
  if ($names -and $names.$locale) { $name = $names.$locale }
  elseif ($names -and $names."en-US") { $name = $names."en-US" }
  elseif ($names) { $name = $names.PSObject.Properties.Value | Select-Object -First 1 }
  if (!$name) { $name = $_.Name }

  [PSCustomObject]@{
    Id   = $_.Id
    Name = $name
    IsActive = $_.IsActive
    Type = $_.Type
  }
} | Sort-Object Name | Format-Table -AutoSize

Write-Host ""
Write-Host "Kopier Id-ene inn i .env som MEWS_SERVICE_IDS (komma-separert)."
