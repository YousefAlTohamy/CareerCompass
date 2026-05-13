<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Log;
use App\Jobs\ProcessMarketScraping;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// ============================================
// SCHEDULED TASKS CONFIGURATION
// ============================================

// Market Intelligence: Automated Job Scraping
// Runs every 48 hours (2 days) at 02:00 AM
// Uses withoutOverlapping to prevent concurrent executions
Schedule::job(new ProcessMarketScraping())
    ->cron('0 2 */2 * *') // Every 2 days at 02:00
    ->name('market-scraping')
    ->withoutOverlapping()
    ->onSuccess(function () {
        Log::info('Market scraping job completed successfully');
    })
    ->onFailure(function () {
        Log::error('Market scraping job failed');
    });

// Execute Daily Scraping
Schedule::command('scraping:execute-daily')
    ->dailyAt('03:00')
    ->name('daily-scraping-execution')
    ->withoutOverlapping()
    ->onSuccess(function () {
        Log::info('Daily scraping execution completed successfully');
    })
    ->onFailure(function () {
        Log::error('Daily scraping execution failed');
    });

// Skill Importance Calculation: Daily at 04:00 AM
// Recalculates skill importance scores for all job titles after scraping
// Uses withoutOverlapping to prevent concurrent executions
Schedule::command('skills:calculate-importance --all')
    ->daily()
    ->at('04:00')
    ->name('skill-importance-calculation')
    ->withoutOverlapping()
    ->onSuccess(function () {
        Log::info('Skill importance calculation completed successfully');
    })
    ->onFailure(function () {
        Log::error('Skill importance calculation failed');
    });

Schedule::command('cv:cleanup-uploads')
    ->dailyAt('01:30')
    ->name('cv-upload-cleanup')
    ->withoutOverlapping()
    ->onSuccess(function () {
        Log::info('CV upload cleanup completed successfully');
    })
    ->onFailure(function () {
        Log::error('CV upload cleanup failed');
    });

// Scraping Source Health Check: Daily at 05:00 AM
// Deactivates sources that remain unhealthy across a rolling window
Schedule::command('scraping-sources:health-check --only-active')
    ->daily()
    ->at('05:00')
    ->name('scraping-source-health-check')
    ->withoutOverlapping()
    ->onSuccess(function () {
        Log::info('Scraping source health check completed successfully');
    })
    ->onFailure(function () {
        Log::error('Scraping source health check failed');
    });

// ============================================
// PRODUCTION DEPLOYMENT NOTES
// ============================================
//
// To activate the scheduler in production, add this to your crontab:
// * * * * * cd /path-to-your-project && php artisan schedule:run >> /dev/null 2>&1
//
// Or run the scheduler daemon (recommended for development):
// php artisan schedule:work
//
// ============================================
