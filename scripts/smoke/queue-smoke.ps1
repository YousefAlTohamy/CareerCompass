$ErrorActionPreference = "Stop"

$composeArgs = @("-f", "docker-compose.yml", "-f", "docker-compose.prod.yml")

Write-Host "Failed jobs:"
& docker compose @composeArgs exec -T backend-api php artisan queue:failed
if ($LASTEXITCODE -ne 0) {
    throw "Failed to query failed jobs"
}

Write-Host "Pending jobs by queue:"
$expression = "echo DB::table('jobs')->select('queue', DB::raw('count(*) as total'))->groupBy('queue')->get()->toJson(JSON_PRETTY_PRINT);"
& docker compose @composeArgs exec -T backend-api php artisan tinker "--execute=$expression"
if ($LASTEXITCODE -ne 0) {
    throw "Failed to query pending jobs"
}
