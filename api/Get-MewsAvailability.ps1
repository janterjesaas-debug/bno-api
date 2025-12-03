# === KONFIG I DETTE SCRIPTET ===
$MEWS_BASE_URL    = "https://api.mews.com"
$MEWS_CLIENT_NAME = "BNO Travel App 1.0"

# BYTT DISSE TIL DINE GYLDIGE PROD-TOKENS
$MEWS_CLIENT_TOKEN = "F104E69101494DE5AC33B39F00B434C3-A861E264D646D73E4FD50F7F97250CB"
$MEWS_ACCESS_TOKEN = "8EB59655491940C2857EB39F00B57EE1-B5C4AE1DA964E96596342B4AA3AD6E0"

# Standard-service: Trysil Turistsenter
$SERVICE_ID = "9f600b99-057d-4a35-90a4-b30600bd0c64"

# Disse tidspunktene er "midnatt lokal tid (Oslo)" konvertert til UTC (23:00 dagen før)
$FIRST_TIME_UNIT_START_UTC = "2026-01-09T23:00:00.000Z"
$LAST_TIME_UNIT_START_UTC  = "2026-01-14T23:00:00.000Z"

# ================================

$uri = "$MEWS_BASE_URL/api/connector/v1/services/getAvailability"

$body = @{
    ClientToken           = $MEWS_CLIENT_TOKEN.Trim()
    AccessToken           = $MEWS_ACCESS_TOKEN.Trim()
    Client                = $MEWS_CLIENT_NAME
    ServiceId             = $SERVICE_ID
    FirstTimeUnitStartUtc = $FIRST_TIME_UNIT_START_UTC
    LastTimeUnitStartUtc  = $LAST_TIME_UNIT_START_UTC
} | ConvertTo-Json -Depth 5

Write-Host ""
Write-Host "== Availability (CategoryId / dato / tilgjengelig) =="
Write-Host "ServiceId: $SERVICE_ID"
Write-Host "Fra:       $FIRST_TIME_UNIT_START_UTC"
Write-Host "Til:       $LAST_TIME_UNIT_START_UTC"
Write-Host ""

$response = Invoke-RestMethod -Method Post -Uri $uri -ContentType "application/json" -Body $body

if ($response.CategoryAvailabilities) {
    $response.CategoryAvailabilities |
        Select-Object CategoryId, TimeUnitStartUtc, AvailableCount |
        Sort-Object TimeUnitStartUtc, CategoryId |
        Format-Table -AutoSize

    # Skriv hele JSON-responsen til fil for debugging
    $response | ConvertTo-Json -Depth 10 | Out-File "availability-response.json" -Encoding utf8
    Write-Host ""
    Write-Host "Full respons lagret til availability-response.json"
} else {
    Write-Host "Ingen CategoryAvailabilities returnert."
    $response | ConvertTo-Json -Depth 10
}
