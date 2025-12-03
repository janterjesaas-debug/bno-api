# === KONFIG I DETTE SCRIPTET ===
$MEWS_BASE_URL    = "https://api.mews.com"
$MEWS_CLIENT_NAME = "BNO Travel App 1.0"

# BYTT DISSE TIL DINE GYLDIGE PROD-TOKENS
$MEWS_CLIENT_TOKEN = "F104E69101494DE5AC33B39F00B434C3-A861E264D646D73E4FD50F7F97250CB"
$MEWS_ACCESS_TOKEN = "8EB59655491940C2857EB39F00B57EE1-B5C4AE1DA964E96596342B4AA3AD6E0"

$MEWS_ENTERPRISE_ID = "f45553a6-6697-485a-a352-b30600bcfd4d"

# ================================

$uri  = "$MEWS_BASE_URL/api/connector/v1/services/getAll"

$body = @{
    ClientToken   = $MEWS_CLIENT_TOKEN.Trim()
    AccessToken   = $MEWS_ACCESS_TOKEN.Trim()
    Client        = $MEWS_CLIENT_NAME
    EnterpriseIds = @($MEWS_ENTERPRISE_ID)
} | ConvertTo-Json -Depth 5

Write-Host ""
Write-Host "== Services (kort oversikt) =="

$response = Invoke-RestMethod -Method Post -Uri $uri -ContentType "application/json" -Body $body

$response.Services |
    Select-Object Id, Name, Type, IsActive |
    Format-Table -AutoSize
