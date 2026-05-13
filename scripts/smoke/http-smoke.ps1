param(
    [string]$BaseUrl = "http://localhost"
)

$ErrorActionPreference = "Stop"
$base = $BaseUrl.TrimEnd("/")
$api = "$base/api"

$urls = @(
    "$api/health",
    "$api/v1/health",
    "$base/"
)

foreach ($url in $urls) {
    Write-Host "Checking $url"
    $status = & curl.exe -fsS -o NUL -w "%{http_code}" $url
    if ($LASTEXITCODE -ne 0 -or $status -ne "200") {
        throw "Smoke check failed for $url with status $status"
    }
}

Write-Host "HTTP smoke test passed"
