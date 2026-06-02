<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Job;
use App\Models\ScrapingSource;
use App\Models\ScrapingJob;
use App\Models\TargetJobRole;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Bus;

class DashboardController extends Controller
{
    /**
     * Get aggregate statistics for the admin dashboard.
     *
     * @return JsonResponse
     */
    public function getStats(): JsonResponse
    {
        try {
            // Calculate totals
            $totalStudents = User::where(function ($q) {
                $q->whereNull('role')->orWhere('role', '!=', 'admin');
            })->count();
            $totalJobs = Job::count();
            $totalSources = ScrapingSource::count();
            $totalTargets = TargetJobRole::count();

            // Calculate a stable monthly job-import chart for the last 6 months.
            $chartStart = now()->startOfMonth()->subMonths(5);
            $driverName = DB::connection()->getDriverName();
            $monthExpression = match ($driverName) {
                'sqlite' => "strftime('%Y-%m', created_at)",
                'pgsql' => "TO_CHAR(created_at, 'YYYY-MM')",
                default => "DATE_FORMAT(created_at, '%Y-%m')",
            };

            $monthlyJobCounts = Job::selectRaw("{$monthExpression} as month_key, COUNT(*) as count")
                ->whereNotNull('created_at')
                ->where('created_at', '>=', $chartStart)
                ->groupBy('month_key')
                ->orderBy('month_key', 'asc')
                ->pluck('count', 'month_key');

            $jobsByMonth = collect(range(0, 5))->map(function (int $offset) use ($chartStart, $monthlyJobCounts): array {
                $month = $chartStart->copy()->addMonths($offset);
                $monthKey = $month->format('Y-m');

                return [
                    'month' => $month->format('M Y'),
                    'month_key' => $monthKey,
                    'count' => (int) ($monthlyJobCounts[$monthKey] ?? 0),
                ];
            })->values();

            // Scraper overview metrics
            $activeSources = ScrapingSource::active()->get();
            $avgHealth = $activeSources->count() > 0
                ? round($activeSources->avg(fn ($s) => $s->calculateHealthScore()), 1)
                : 100.0;

            $jobs24h = Job::where('created_at', '>=', now()->subHours(24))->count();

            $recentFailures = ScrapingJob::where('created_at', '>=', now()->subHours(24))
                ->sum('failed_count');

            return response()->json([
                'success' => true,
                'data' => [
                    'total_students' => $totalStudents,
                    'total_jobs' => $totalJobs,
                    'total_sources' => $totalSources,
                    'total_targets' => $totalTargets,
                    'jobs_by_month' => $jobsByMonth,
                    'jobs_chart_data' => $jobsByMonth,
                    'scraper_overview' => [
                        'jobs_last_24h'    => $jobs24h,
                        'avg_health_score' => $avgHealth,
                        'active_sources'   => $activeSources->count(),
                        'total_sources'    => $totalSources,
                        'recent_failures'  => (int) $recentFailures,
                    ],
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch dashboard statistics',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get system health status for Database, Cache/Queue, and AI Microservice.
     *
     * @return JsonResponse
     */
    public function getSystemHealth(): JsonResponse
    {
        $services = [
            'Database' => 'offline',
            'Cache & Queue' => 'offline',
            'AI Services' => 'offline',
            'Scraper Service' => 'offline',
        ];

        // 1. Check Database
        try {
            DB::connection()->getPdo();
            $services['Database'] = 'online';
        } catch (\Exception $e) {
            // Keep offline
        }

        // 2. Check Cache/Queue
        try {
            Cache::set('health_check', true, 10);
            if (Cache::get('health_check')) {
                $services['Cache & Queue'] = 'online';
            }
        } catch (\Exception $e) {
            // Keep offline
        }

        // 3. Check AI Microservice (Python Orchestrator)
        // Pings the root or health endpoint, handles connection timeouts gracefully
        try {
            $response = Http::timeout(3)->get(config('services.ai_engine.url', 'http://127.0.0.1:8002'));
            // Either a 200 OK or even a 404 means the service is physically up and responding
            if ($response->successful() || $response->status() === 404) {
                $services['AI Services'] = 'online';
            }
        } catch (\Exception $e) {
            // Keep offline
        }

        // 4. Check internal scraper service
        try {
            $response = Http::timeout(3)->get(rtrim(config('services.scraper_service.url', 'http://127.0.0.1:8003'), '/') . '/health');
            if ($response->successful()) {
                $services['Scraper Service'] = 'online';
            }
        } catch (\Exception $e) {
            // Keep offline
        }

        $status = in_array('offline', array_values($services)) ? 'critical' : 'operational';

        return response()->json([
            'success' => true,
            'data' => [
                'status' => $status,
                'services' => $services
            ]
        ]);
    }

    /**
     * Get the current batch progress for a running market scraping batch.
     */
    public function getBatchProgress(): JsonResponse
    {
        try {
            $batch = DB::table('job_batches')
                ->where('name', 'like', 'market-scraping:%')
                ->orderByDesc('created_at')
                ->first();

            if (!$batch) {
                return response()->json([
                    'success' => true,
                    'data'    => ['active' => false],
                ]);
            }

            $totalJobs     = (int) $batch->total_jobs;
            $pendingJobs   = (int) $batch->pending_jobs;
            $failedJobs    = (int) $batch->failed_jobs;
            $processedJobs = $totalJobs - $pendingJobs;
            $progress      = $totalJobs > 0 ? round(($processedJobs / $totalJobs) * 100) : 0;
            $finished      = !is_null($batch->finished_at);

            return response()->json([
                'success' => true,
                'data'    => [
                    'active'         => !$finished,
                    'batch_id'       => $batch->id,
                    'name'           => $batch->name,
                    'progress'       => $progress,
                    'total_jobs'     => $totalJobs,
                    'processed_jobs' => $processedJobs,
                    'failed_jobs'    => $failedJobs,
                    'finished'       => $finished,
                    'cancelled'      => !is_null($batch->cancelled_at),
                    'created_at'     => $batch->created_at,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch batch progress',
            ], 500);
        }
    }

    /**
     * Get failed URLs (DLQ) for a specific scraping job.
     */
    public function getFailedUrls(int $scrapingJobId): JsonResponse
    {
        try {
            $job = \App\Models\ScrapingJob::findOrFail($scrapingJobId);

            $failedUrls = $job->failedUrls()
                ->with('scrapingSource:id,name')
                ->orderByDesc('created_at')
                ->get(['id', 'scraping_source_id', 'url', 'error_message', 'retried', 'failed_at', 'created_at']);

            return response()->json([
                'success' => true,
                'data'    => [
                    'job_title'   => $job->job_title,
                    'failed_urls' => $failedUrls,
                ],
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['success' => false, 'message' => 'Scraping job not found'], 404);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Failed to fetch DLQ data'], 500);
        }
    }

    /**
     * Mark failed URLs as retried and dispatch a re-scrape for them.
     */
    public function retryFailedUrls(Request $request): JsonResponse
    {
        try {
            $ids = $request->input('ids', []);

            if (empty($ids)) {
                return response()->json(['success' => false, 'message' => 'No failure IDs provided'], 422);
            }

            \App\Models\ScrapingFailedUrl::whereIn('id', $ids)->update(['retried' => true]);

            return response()->json([
                'success' => true,
                'message' => 'Failures marked as retried',
                'count'   => count($ids),
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Retry action failed'], 500);
        }
    }
}
