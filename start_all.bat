@echo off
echo [Career Compass] Starting Docker Environment...
docker-compose up -d

echo [Career Compass] Running Database Migrations...
docker-compose exec backend-api php artisan migrate

echo [Career Compass] All services are running!
echo Frontend: http://localhost
echo API Documentation: http://localhost/api/documentation (if applicable)
pause