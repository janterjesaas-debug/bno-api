# === KONFIG I DETTE SCRIPTET ===
$MEWS_BASE_URL    = "https://api.mews.com"
$MEWS_CLIENT_NAME = "BNO Travel App 1.0"

# BYTT DISSE TIL DINE GYLDIGE PROD-TOKENS
$MEWS_CLIENT_TOKEN = "F104E69101494DE5AC33B39F00B434C3-A861E264D646D73E4FD50F7F97250CB"
$MEWS_ACCESS_TOKEN = "8EB59655491940C2857EB39F00B57EE1-B5C4AE1DA964E96596342B4AA3AD6E0"

$MEWS_ENTERPRISE_ID = "f45553a6-6697-485a-a352-b30600bcfd4d"

# Om du vil avgrense til spesifikke services, kan du legge inn service-Id-ene her:
$serviceIds = @(
    "9f600b99-057d-4a35-90a4-b30600bd0c64", # Trysil Turistsenter
    "c4964b1d-2303-4ebd-9be8-b3140084d802", # Trysil Høyfjellssenter
    "ba0090d5-a22d-4836-a5de-b3140084990e", # Trysilfjell Hytteområde
    "c6d6a149-4e06-4cd0-b44b-b3140086ce52", # Tandådalen Sälen
    "394c01db-2c18-46a9-b1a8-b31400865186", # Högfjället Sälen
    "35745e9e-1318-42e4-8b9d-b31400855336"  # Lindvallen Sälen
)
# ================================

$uri = "$MEWS_BASE_URL/api/connector/v1/resourceCategories/getAll"

$body = @{
    ClientToken    = $MEWS_CLIENT_TOKEN.Trim()
    AccessToken    = $MEWS_ACCESS_TOKEN.Trim()
    Client         = $MEWS_CLIENT_NAME
    EnterpriseIds  = @($MEWS_ENTERPRISE_ID)
    ServiceIds     = $serviceIds
    ActivityStates = @("Active")
    Limitation     = @{ Count = 1000 }
} | ConvertTo-Json -Depth 6

Write-Host ""
Write-Host "== Resource categories (kort) =="
Write-Host ""

$response = Invoke-RestMethod -Method Post -Uri $uri -ContentType "application/json" -Body $body

# Lagre full respons til fil for debugging
$response | ConvertTo-Json -Depth 10 | Out-File "resource-categories-response.json" -Encoding utf8
Write-Host "Full respons lagret til resource-categories-response.json"
Write-Host ""

if (-not $response.ResourceCategories -or $response.ResourceCategories.Count -eq 0) {
    Write-Host "Ingen ResourceCategories returnert."
    return
}

$response.ResourceCategories |
    Select-Object Id, ServiceId, Name, Names, IsActive, Ordering |
    Sort-Object ServiceId, Ordering |
    Format-Table -AutoSize
