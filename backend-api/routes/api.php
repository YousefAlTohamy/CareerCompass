<?php

declare(strict_types=1);

use App\Http\Controllers\Api\Admin\AdminJobController;
use App\Http\Controllers\Api\Admin\AdminUserController;
use App\Http\Controllers\Api\Admin\DashboardController;
use App\Http\Controllers\Api\Admin\ScrapingSourceController;
use App\Http\Controllers\Api\Admin\TargetJobRoleController;
use App\Http\Controllers\Api\ApplicationController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CvController;
use App\Http\Controllers\Api\GapAnalysisController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\InternalProxyController;
use App\Http\Controllers\Api\JobController;
use App\Http\Controllers\Api\MarketIntelligenceController;
use App\Http\Controllers\Api\MetricsController;
use App\Http\Controllers\Api\ScrapedJobController;
use App\Http\Controllers\Api\TargetRoleController;
use Illuminate\Support\Facades\Route;

$registerCareerCompassRoutes = static function (string $namePrefix = 'api.'): void {
    Route::get('/health', [HealthController::class, 'live'])->middleware('throttle:api');
    Route::get('/ready', [HealthController::class, 'ready'])->middleware('throttle:api');
    Route::get('/metrics', [MetricsController::class, 'prometheus'])
        ->middleware(['monitoring.token', 'throttle:monitoring']);
    Route::get('/cv-files/{cvAnalysis}', [CvController::class, 'download'])
        ->middleware('signed')
        ->whereNumber('cvAnalysis')
        ->name($namePrefix . 'cv.download');

    Route::middleware(['guest:sanctum', 'throttle:login'])->group(function (): void {
        Route::post('/register', [AuthController::class, 'register']);
        Route::post('/login', [AuthController::class, 'login']);
    });

    Route::middleware('throttle:api')->group(function (): void {
        Route::get('/jobs', [JobController::class, 'index']);
        Route::get('/jobs/{id}', [JobController::class, 'show'])->whereNumber('id');
    });

    Route::middleware(['scraper.token', 'throttle:scraper'])->group(function (): void {
        Route::post('/jobs/import/check', [ScrapedJobController::class, 'checkExistence']);
        Route::post('/jobs/import', [ScrapedJobController::class, 'import']);
        Route::post('/jobs/import/failed', [ScrapedJobController::class, 'reportFailure']);
        Route::get('/proxies/active', [InternalProxyController::class, 'active']);
    });

    Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () use ($namePrefix): void {
        Route::get('/user', [AuthController::class, 'user']);
        Route::put('/user/profile', [AuthController::class, 'updateProfile']);
        Route::post('/logout', [AuthController::class, 'logout']);

        Route::post('/upload-cv', [CvController::class, 'upload'])->middleware('throttle:uploads');
        Route::get('/user/skills', [CvController::class, 'getUserSkills']);
        Route::delete('/user/skills/{skillId}', [CvController::class, 'removeSkill'])->whereNumber('skillId');
        Route::get('/user/cv-analysis', [GapAnalysisController::class, 'getCvAnalysis']);
        Route::get('/user/cv-analysis/download-url', [CvController::class, 'downloadUrl']);

        Route::get('/jobs/recommended', [JobController::class, 'getRecommended']);
        Route::post('/jobs/scrape', [JobController::class, 'scrapeAndStore']);
        Route::post('/jobs/scrape-if-missing', [JobController::class, 'scrapeJobTitleIfMissing']);
        Route::get('/scraping-status/{jobId}', [JobController::class, 'checkScrapingStatus'])
            ->whereNumber('jobId')
            ->name($namePrefix . 'scraping.status');

        Route::get('/gap-analysis/job/{jobId}', [GapAnalysisController::class, 'analyzeJob'])->whereNumber('jobId');
        Route::get('/gap-analysis/role/{roleId}', [GapAnalysisController::class, 'analyzeRole'])->whereNumber('roleId');
        Route::post('/gap-analysis/batch', [GapAnalysisController::class, 'analyzeMultipleJobs']);
        Route::get('/gap-analysis/recommendations', [GapAnalysisController::class, 'getRecommendations']);

        Route::get('/target-roles', [TargetRoleController::class, 'index']);
        Route::get('/market/overview', [MarketIntelligenceController::class, 'getMarketOverview']);
        Route::get('/market/role-statistics/{roleTitle}', [MarketIntelligenceController::class, 'getRoleStatistics']);
        Route::get('/market/trending-skills', [MarketIntelligenceController::class, 'getTrendingSkills']);
        Route::get('/market/skill-demand/{roleTitle}', [MarketIntelligenceController::class, 'getSkillDemand']);

        $applicationRoutes = Route::apiResource('applications', ApplicationController::class);
        if ($namePrefix !== 'api.') {
            $applicationRoutes->names($namePrefix . 'applications');
        }

        Route::middleware('admin')->prefix('admin')->group(function () use ($namePrefix): void {
            Route::get('/dashboard/stats', [DashboardController::class, 'getStats']);
            Route::get('/dashboard/health', [DashboardController::class, 'getSystemHealth']);
            Route::get('/dashboard/batch-progress', [DashboardController::class, 'getBatchProgress']);
            Route::get('/dashboard/failed-urls/{scrapingJobId}', [DashboardController::class, 'getFailedUrls'])
                ->whereNumber('scrapingJobId');
            Route::post('/dashboard/retry-failures', [DashboardController::class, 'retryFailedUrls']);

            Route::get('/jobs', [AdminJobController::class, 'index']);
            Route::get('/jobs/{id}', [AdminJobController::class, 'show'])->whereNumber('id');
            Route::delete('/jobs/{id}', [AdminJobController::class, 'destroy'])->whereNumber('id');

            Route::get('/users', [AdminUserController::class, 'index']);
            Route::get('/users/{id}', [AdminUserController::class, 'show'])->whereNumber('id');
            Route::post('/users/{id}/toggle-ban', [AdminUserController::class, 'toggleBan'])->whereNumber('id');

            Route::get('scraping-sources/status', [ScrapingSourceController::class, 'getStatus']);
            Route::patch('scraping-sources/{scrapingSource}/toggle', [ScrapingSourceController::class, 'toggleStatus'])
                ->whereNumber('scrapingSource');
            Route::post('scraping-sources/test', [ScrapingSourceController::class, 'test']);
            Route::post('scraping-sources/{id}/test', [ScrapingSourceController::class, 'testSingle'])
                ->whereNumber('id');

            $sourceRoutes = Route::apiResource('scraping-sources', ScrapingSourceController::class);
            if ($namePrefix !== 'api.') {
                $sourceRoutes->names($namePrefix . 'admin.scraping-sources');
            }

            Route::get('target-roles', [TargetJobRoleController::class, 'index']);
            Route::post('target-roles', [TargetJobRoleController::class, 'store']);
            Route::patch('target-roles/{id}/toggle', [TargetJobRoleController::class, 'toggleActive'])->whereNumber('id');
            Route::delete('target-roles/{id}', [TargetJobRoleController::class, 'destroy'])->whereNumber('id');

            Route::post('scraping/run-full', [TargetJobRoleController::class, 'runFullScraping']);
        });
    });
};

$registerCareerCompassRoutes('api.');

Route::prefix('v1')->group(function () use ($registerCareerCompassRoutes): void {
    $registerCareerCompassRoutes('api.v1.');
});
