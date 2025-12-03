param(
    [Parameter(Mandatory = $true)]
    [string]$ClientToken,

    [Parameter(Mandatory = $true)]
    [string]$AccessToken
)

# === Grunninfo ===
$global:MEWS_BASE_URL    = "https://api.mews.com"
$global:MEWS_CLIENT_NAME = "BNO Travel App 1.0"

# === PROD-tokens fra Mews ===
$global:MEWS_CLIENT_TOKEN = $ClientToken
$global:MEWS_ACCESS_TOKEN = $AccessToken

# === Enterprise ===
$global:MEWS_ENTERPRISE_ID = "f45553a6-6697-485a-a352-b30600bcfd4d"

# === Services (områder) ===
$global:MEWS_SERVICE_ID_TRYSIL_TURISTSENTER     = "9f600b99-057d-4a35-90a4-b30600bd0c64"
$global:MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER  = "c4964b1d-2303-4ebd-9be8-b3140084d802"
$global:MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE = "ba0090d5-a22d-4836-a5de-b3140084990e"
$global:MEWS_SERVICE_ID_TANDADALEN_SALEN        = "c6d6a149-4e06-4cd0-b44b-b3140086ce52"
$global:MEWS_SERVICE_ID_HOGFJALLET_SALEN        = "394c01db-2c18-46a9-b1a8-b31400865186"
$global:MEWS_SERVICE_ID_LINDVALLEN_SALEN        = "35745e9e-1318-42e4-8b9d-b31400855336"

Write-Host "✅ MEWS-variabler er satt i denne PowerShell-sesjonen."
