param(
    [string]  $ServiceId = "9f600b99-057d-4a35-90a4-b30600bd0c64", # default: Trysil Turistsenter
    [datetime]$From      = [datetime]"2025-12-20",                  # lokal dato (Europe/Oslo)
    [datetime]$To        = [datetime]"2025-12-27"                   # lokal dato (Europe/Oslo), eksklusiv
)

# === KONFIG ===
$MEWS_BASE_URL    = "https://api.mews.com"
$MEWS_CLIENT_NAME = "BNO Travel App 1.0"

# BYTT DISSE TIL DINE GYLDIGE PROD-TOKENS
$MEWS_CLIENT_TOKEN = "F104E69101494DE5AC33B39F00B434C3-A861E264D646D73E4FD50F7F97250CB"
$MEWS_ACCESS_TOKEN = "8EB59655491940C2857EB39F00B57EE1-B5C4AE1DA964E96596342B4AA3AD6E0"

$MEWS_ENTERPRISE_ID = "f45553a6-6697-485a-a352-b30600bcfd4d"
# ==============

# For vinter-sesong i Europe/Oslo:
# Mews har tidligere godtatt verdier som:
#   2026-01-09T23:00:00.000Z  for en lokal "fra" 2026-01-10
#
# Vi generaliserer det til:
#   First = (From - 1 dag) kl 23:00:00.000Z
#   Last  = (To   - 1 dag) kl 23:00:00.000Z

$firstDate = $From.AddDays(-1).Date
$lastDate  = $To.AddDays(-1).Date

$FIRST_TIME_UNIT_START_UTC = ('{0:yyyy-MM-dd}T23:00:00.000Z' -f $firstDate)
$LAST_TIME_UNIT_START_UTC  = ('{0:yyyy-MM-dd}T23:00:00.000Z' -f $lastDate)

Write-Host ""
Write-Host "== Mews availability MED kategorinavn =="
Write-Host "ServiceId: $ServiceId"
Write-Host "Fra (UTC): $FIRST_TIME_UNIT_START_UTC"
Write-Host "Til (UTC): $LAST_TIME_UNIT_START_UTC"
Write-Host ""

# === 1) Availability ===
$availUri = "$MEWS_BASE_URL/api/connector/v1/services/getAvailability"

$availBody = @{
    ClientToken           = $MEWS_CLIENT_TOKEN.Trim()
    AccessToken           = $MEWS_ACCESS_TOKEN.Trim()
    Client                = $MEWS_CLIENT_NAME
    ServiceId             = $ServiceId
    FirstTimeUnitStartUtc = $FIRST_TIME_UNIT_START_UTC
    LastTimeUnitStartUtc  = $LAST_TIME_UNIT_START_UTC
} | ConvertTo-Json -Depth 5

$availabilityResponse = Invoke-RestMethod -Method Post -Uri $availUri -ContentType "application/json" -Body $availBody

$availabilityResponse | ConvertTo-Json -Depth 10 | Out-File "availability-with-names-availability.json" -Encoding utf8

if (-not $availabilityResponse.CategoryAvailabilities -or $availabilityResponse.CategoryAvailabilities.Count -eq 0) {
    Write-Host "Ingen CategoryAvailabilities returnert."
    return
}

# === 2) ResourceCategories for samme service ===
$rcUri = "$MEWS_BASE_URL/api/connector/v1/resourceCategories/getAll"

$rcBody = @{
    ClientToken    = $MEWS_CLIENT_TOKEN.Trim()
    AccessToken    = $MEWS_ACCESS_TOKEN.Trim()
    Client         = $MEWS_CLIENT_NAME
    EnterpriseIds  = @($MEWS_ENTERPRISE_ID)
    ServiceIds     = @($ServiceId)
    ActivityStates = @("Active")
    Limitation     = @{ Count = 1000 }
} | ConvertTo-Json -Depth 6

$rcResponse = Invoke-RestMethod -Method Post -Uri $rcUri -ContentType "application/json" -Body $rcBody

$rcResponse | ConvertTo-Json -Depth 10 | Out-File "availability-with-names-resourcecategories.json" -Encoding utf8

if (-not $rcResponse.ResourceCategories -or $rcResponse.ResourceCategories.Count -eq 0) {
    Write-Host "Ingen ResourceCategories returnert."
    return
}

$categoryLookup = @{}
foreach ($rc in $rcResponse.ResourceCategories) {
    $categoryLookup[$rc.Id] = @{
        ServiceId = $rc.ServiceId
        Name_nbNO = $rc.Names.'nb-NO'
        Capacity  = $rc.Capacity
    }
}

# === 3) Bygg output ===
$dates = $availabilityResponse.TimeUnitStartsUtc
$rows  = @()

foreach ($ca in $availabilityResponse.CategoryAvailabilities) {
    $info = $categoryLookup[$ca.CategoryId]

    for ($i = 0; $i -lt $dates.Count; $i++) {
        $rows += [PSCustomObject]@{
            DateUtc        = $dates[$i]
            ServiceId      = $info.ServiceId
            CategoryId     = $ca.CategoryId
            CategoryName   = $info.Name_nbNO
            Capacity       = $info.Capacity
            AvailableCount = $ca.Availabilities[$i]
        }
    }
}

if ($rows.Count -eq 0) {
    Write-Host "Ingen rader å vise."
    return
}

$rows | Sort-Object DateUtc, CategoryName | Format-Table -AutoSize
