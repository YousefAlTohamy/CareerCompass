<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CvController;
use App\Http\Controllers\Api\GapAnalysisController;
use App\Http\Controllers\Api\JobController;
use App\Http\Controllers\Api\MarketIntelligenceController;
use App\Http\Controllers\Api\Admin\ScrapingSourceController;
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

// Authentication routes (no auth required)
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

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
    // Get authenticated user
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    // Logout
    Route::post('/logout', [AuthController::class, 'logout']);

    // CV Upload and Skill Management
    Route::post('/upload-cv', [CvController::class, 'upload']);
    Route::get('/user/skills', [CvController::class, 'getUserSkills']);
    Route::delete('/user/skills/{skillId}', [CvController::class, 'removeSkill']);

    // Recommended jobs for authenticated user
    // ⚠️ Must be inside this group (auth:sanctum) and BEFORE the public /jobs/{id} wildcard
    // Laravel evaluates routes in registration order — specific routes must precede wildcards
    Route::get('/jobs/recommended', [JobController::class, 'getRecommended']);

    // Job Scraping
    Route::post('/jobs/scrape', [JobController::class, 'scrapeAndStore']);
    Route::post('/jobs/scrape-if-missing', [JobController::class, 'scrapeJobTitleIfMissing']);
    Route::get('/scraping-status/{jobId}', [JobController::class, 'checkScrapingStatus'])->name('api.scraping.status');

    // Gap Analysis
    Route::get('/gap-analysis/job/{jobId}', [GapAnalysisController::class, 'analyzeJob']);
    Route::post('/gap-analysis/batch', [GapAnalysisController::class, 'analyzeMultipleJobs']);
    Route::get('/gap-analysis/recommendations', [GapAnalysisController::class, 'getRecommendations']);

    // Market Intelligence
    Route::get('/market/overview', [MarketIntelligenceController::class, 'getMarketOverview']);
    Route::get('/market/role-statistics/{roleTitle}', [MarketIntelligenceController::class, 'getRoleStatistics']);
    Route::get('/market/trending-skills', [MarketIntelligenceController::class, 'getTrendingSkills']);
    Route::get('/market/skill-demand/{roleTitle}', [MarketIntelligenceController::class, 'getSkillDemand']);

    // Job Application Tracker
    Route::apiResource('applications', \App\Http\Controllers\Api\ApplicationController::class);

    // ─── Admin: Scraping Sources Management ───────────────────────────────────
    Route::prefix('admin')->group(function () {
        // Specific routes MUST come before apiResource (wildcards)
        Route::patch('scraping-sources/{scrapingSource}/toggle', [ScrapingSourceController::class, 'toggleStatus']);
        Route::post('scraping-sources/test', [ScrapingSourceController::class, 'test']);

        // Full CRUD for scraping sources
        Route::apiResource('scraping-sources', ScrapingSourceController::class);

        // Target Job Roles
        Route::get('target-roles', [\App\Http\Controllers\Api\Admin\TargetJobRoleController::class, 'index']);
        Route::post('target-roles', [\App\Http\Controllers\Api\Admin\TargetJobRoleController::class, 'store']);
        Route::patch('target-roles/{id}/toggle', [\App\Http\Controllers\Api\Admin\TargetJobRoleController::class, 'toggleActive']);
        Route::delete('target-roles/{id}', [\App\Http\Controllers\Api\Admin\TargetJobRoleController::class, 'destroy']);

        // Quick Execute Scraper
        Route::post('scraping/run-full', [\App\Http\Controllers\Api\Admin\TargetJobRoleController::class, 'runFullScraping']);
    });
});
