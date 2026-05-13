#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/app}"

rm -f "${APP_DIR}/bootstrap/cache/packages.php" \
      "${APP_DIR}/bootstrap/cache/services.php" \
      "${APP_DIR}/bootstrap/cache/config.php" \
      "${APP_DIR}/bootstrap/cache/routes.php" \
      "${APP_DIR}/bootstrap/cache/events.php" || true

mkdir -p "${APP_DIR}/storage/framework/cache" \
         "${APP_DIR}/storage/framework/sessions" \
         "${APP_DIR}/storage/framework/views" \
         "${APP_DIR}/bootstrap/cache"

chown -R www-data:www-data "${APP_DIR}/storage" "${APP_DIR}/bootstrap/cache" 2>/dev/null || true

exec docker-php-entrypoint "$@"
