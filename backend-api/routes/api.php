<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CvController;
use App\Http\Resources\UserResource;
use App\Http\Controllers\Api\GapAnalysisController;
use App\Http\Controllers\Api\JobController;
use App\Http\Controllers\Api\MarketIntelligenceController;
use App\Http\Controllers\Api\ApplicationController;
use App\Http\Controllers\Api\Admin\ScrapingSourceController;
use App\Http\Controllers\Api\Admin\DashboardController;
use App\Http\Controllers\Api\Admin\AdminJobController;
use App\Http\Controllers\Api\Admin\AdminUserController;
use App\Http\Controllers\Api\Admin\TargetJobRoleController;
use App\Http\Controllers\Api\ScrapedJobController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Authentication routes (require user to be a guest)
Route::middleware('guest:sanctum')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
});

// Public routes (no authentication required)
Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'service' => 'CareerCompass API',
        'version' => '1.0.0',
    ]);
});

// Job browsing (public)
Route::get('/jobs', [JobController::class, 'index']);
// ⚠️ whereNumber ensures /jobs/recommended is NOT caught by this wildcard
Route::get('/jobs/{id}', [JobController::class, 'show'])->whereNumber('id');

// Protected routes (require authentication)
Route::middleware('auth:sanctum')->group(function () {
    // Get authenticated user (comprehensive data via UserResource)
    Route::get('/user', function (Request $request) {
        $user = $request->user()->load(['profile', 'experiences', 'skills', 'cvAnalysis']);
        return new UserResource($user);
    });

    // Profile Management
    Route::put('/user/profile', [AuthController::class, 'updateProfile']);

    // Logout
    Route::post('/logout', [AuthController::class, 'logout']);

    // CV Upload and Skill Management
    Route::post('/upload-cv', [CvController::class, 'upload']);
    Route::get('/user/skills', [CvController::class, 'getUserSkills']);
    Route::delete('/user/skills/{skillId}', [CvController::class, 'removeSkill']);
    Route::get('/user/cv-analysis', [GapAnalysisController::class, 'getCvAnalysis']);

    // Recommended jobs for authenticated user
    // ⚠️ Must be inside this group (auth:sanctum) and BEFORE the public /jobs/{id} wildcard
    // Laravel evaluates routes in registration order — specific routes must precede wildcards
    Route::get('/jobs/recommended', [JobController::class, 'getRecommended']);

    // Job Scraping
    Route::post('/jobs/scrape', [JobController::class, 'scrapeAndStore']);
    Route::post('/jobs/scrape-if-missing', [JobController::class, 'scrapeJobTitleIfMissing']);
    Route::get('/scraping-status/{jobId}', [JobController::class, 'checkScrapingStatus'])->name('api.scraping.status');

    // Python Scraper Integration
    Route::post('/jobs/import/check', [ScrapedJobController::class, 'checkExistence']);
    Route::post('/jobs/import', [ScrapedJobController::class, 'import']);
    Route::post('/jobs/import/failed', [ScrapedJobController::class, 'reportFailure']);

    // Gap Analysis
    Route::get('/gap-analysis/job/{jobId}', [GapAnalysisController::class, 'analyzeJob']);
    Route::get('/gap-analysis/role/{roleId}', [GapAnalysisController::class, 'analyzeRole']);
    Route::post('/gap-analysis/batch', [GapAnalysisController::class, 'analyzeMultipleJobs']);
    Route::get('/gap-analysis/recommendations', [GapAnalysisController::class, 'getRecommendations']);

    // Market Intelligence & Target Roles
    Route::get('/target-roles', function() {
        return \App\Models\TargetJobRole::where('is_active', true)->get();
    });
    Route::get('/market/overview', [MarketIntelligenceController::class, 'getMarketOverview']);
    Route::get('/market/role-statistics/{roleTitle}', [MarketIntelligenceController::class, 'getRoleStatistics']);
    Route::get('/market/trending-skills', [MarketIntelligenceController::class, 'getTrendingSkills']);
    Route::get('/market/skill-demand/{roleTitle}', [MarketIntelligenceController::class, 'getSkillDemand']);

    // Job Application Tracker
    Route::apiResource('applications', ApplicationController::class);

    // ─── Admin: Scraping Sources Management ───────────────────────────────────
    // Requires both authentication AND admin role
    Route::middleware('admin')->prefix('admin')->group(function () {
        // Admin Dashboard Stats & Health
        Route::get('/dashboard/stats', [DashboardController::class, 'getStats']);
        Route::get('/dashboard/health', [DashboardController::class, 'getSystemHealth']);
        Route::get('/dashboard/batch-progress', [DashboardController::class, 'getBatchProgress']);
        Route::get('/dashboard/failed-urls/{scrapingJobId}', [DashboardController::class, 'getFailedUrls']);
        Route::post('/dashboard/retry-failures', [DashboardController::class, 'retryFailedUrls']);

        // Admin Jobs Management
        Route::get('/jobs', [AdminJobController::class, 'index']);
        Route::get('/jobs/{id}', [AdminJobController::class, 'show']);
        Route::delete('/jobs/{id}', [AdminJobController::class, 'destroy']);

        // Admin Users Management
        Route::get('/users', [AdminUserController::class, 'index']);
        Route::get('/users/{id}', [AdminUserController::class, 'show']);
        Route::post('/users/{id}/toggle-ban', [AdminUserController::class, 'toggleBan']);

        // Specific routes MUST come before apiResource (wildcards)
        Route::patch('scraping-sources/{scrapingSource}/toggle', [ScrapingSourceController::class, 'toggleStatus']);
        Route::post('scraping-sources/test', [ScrapingSourceController::class, 'test']);

        // Full CRUD for scraping sources
        Route::apiResource('scraping-sources', ScrapingSourceController::class);

        // Target Job Roles
        Route::get('target-roles', [TargetJobRoleController::class, 'index']);
        Route::post('target-roles', [TargetJobRoleController::class, 'store']);
        Route::patch('target-roles/{id}/toggle', [TargetJobRoleController::class, 'toggleActive']);
        Route::delete('target-roles/{id}', [TargetJobRoleController::class, 'destroy']);

        // Quick Execute Scraper
        Route::post('scraping/run-full', [TargetJobRoleController::class, 'runFullScraping']);
    });
});
