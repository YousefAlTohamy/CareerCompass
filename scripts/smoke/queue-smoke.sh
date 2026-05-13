#!/usr/bin/env bash
set -euo pipefail

docker compose exec -T backend-api php artisan queue:failed >/tmp/cc-failed-jobs.txt
docker compose exec -T backend-api php artisan tinker --execute="echo DB::table('jobs')->select('queue', DB::raw('count(*) as total'))->groupBy('queue')->get()->toJson(JSON_PRETTY_PRINT);" >/tmp/cc-pending-jobs.txt

echo "Failed jobs:"
cat /tmp/cc-failed-jobs.txt
echo "Pending jobs:"
cat /tmp/cc-pending-jobs.txt
