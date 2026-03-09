<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Job;
use App\Models\ScrapingSource;
use App\Models\TargetJobRole;
use Illuminate\Http\JsonResponse;

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
            $totalStudents = User::whereNull('role')->orWhere('role', 'student')->count();
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
}
