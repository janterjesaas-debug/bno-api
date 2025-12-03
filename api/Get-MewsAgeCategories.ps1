# === KONFIG I DETTE SCRIPTET ===
$MEWS_BASE_URL    = "https://api.mews.com"
$MEWS_CLIENT_NAME = "BNO Travel App 1.0"

$MEWS_CLIENT_TOKEN = "F104E69101494DE5AC33B39F00B434C3-A861E264D646D73E4FD50F7F97250CB"
$MEWS_ACCESS_TOKEN = "8EB59655491940C2857EB39F00B57EE1-B5C4AE1DA964E96596342B4AA3AD6E0"

$MEWS_ENTERPRISE_ID = "f45553a6-6697-485a-a352-b30600bcfd4d"

$MEWS_SERVICE_ID_TRYSIL_TURISTSENTER     = "9f600b99-057d-4a35-90a4-b30600bd0c64"
$MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER  = "c4964b1d-2303-4ebd-9be8-b3140084d802"
$MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE = "ba0090d5-a22d-4836-a5de-b3140084990e"
$MEWS_SERVICE_ID_TANDADALEN_SALEN        = "c6d6a149-4e06-4cd0-b44b-b3140086ce52"
$MEWS_SERVICE_ID_HOGFJALLET_SALEN        = "394c01db-2c18-46a9-b1a8-b31400865186"
$MEWS_SERVICE_ID_LINDVALLEN_SALEN        = "35745e9e-1318-42e4-8b9d-b31400855336"
# ================================

$uri = "$MEWS_BASE_URL/api/connector/v1/ageCategories/getAll"

$serviceIds = @(
    $MEWS_SERVICE_ID_TRYSIL_TURISTSENTER,
    $MEWS_SERVICE_ID_TRYSIL_HOYFJELLSSENTER,
    $MEWS_SERVICE_ID_TRYSILFJELL_HYTTEOMRADE,
    $MEWS_SERVICE_ID_TANDADALEN_SALEN,
    $MEWS_SERVICE_ID_HOGFJALLET_SALEN,
    $MEWS_SERVICE_ID_LINDVALLEN_SALEN
) | Where-Object { $_ -and $_.Trim() -ne "" }

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
Write-Host "== Age categories (kort) =="

$response = Invoke-RestMethod -Method Post -Uri $uri -ContentType "application/json" -Body $body

if ($response.AgeCategories) {
    $response.AgeCategories |
        Select-Object Id, ServiceId, Classification, MinimalAge, MaximalAge, Name |
        Sort-Object ServiceId, MinimalAge |
        Format-Table -AutoSize
} else {
    Write-Host "Ingen AgeCategories returnert."
    $response | ConvertTo-Json -Depth 10
}
