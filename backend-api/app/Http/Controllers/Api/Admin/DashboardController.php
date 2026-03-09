<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Job;
use App\Models\ScrapingSource;
use App\Models\TargetJobRole;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

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

            // Calculate chart data for jobs scraped in the last 7 days
            $jobsChartData = Job::selectRaw('DATE(created_at) as date, COUNT(*) as count')
                ->where('created_at', '>=', now()->subDays(7))
                ->groupBy('date')
                ->orderBy('date', 'asc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => [
                    'total_students' => $totalStudents,
                    'total_jobs' => $totalJobs,
                    'total_sources' => $totalSources,
                    'total_targets' => $totalTargets,
                    'jobs_chart_data' => $jobsChartData
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
            'AI Services' => 'offline'
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
            $response = Http::timeout(3)->get(env('AI_ENGINE_URL', 'http://127.0.0.1:8001'));
            // Either a 200 OK or even a 404 means the service is physically up and responding
            if ($response->successful() || $response->status() === 404) {
                $services['AI Services'] = 'online';
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
}
