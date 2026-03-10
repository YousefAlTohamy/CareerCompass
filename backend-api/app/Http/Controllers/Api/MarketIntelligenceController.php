<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\JobRoleStatistic;
use App\Models\Job;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class MarketIntelligenceController extends Controller
{
    /**
     * Get market statistics for a specific job role.
     *
     * @param string $roleTitle
     * @return JsonResponse
     */
    public function getRoleStatistics(string $roleTitle)
    {
        // Find statistics for the role
        $statistics = JobRoleStatistic::where('role_title', 'like', "%{$roleTitle}%")
            ->fresh()
            ->first();

        if (!$statistics) {
            return response()->json([
                'success' => false,
                'message' => "No market data available for '{$roleTitle}'. Data will be available after automated scraping.",
                'role_title' => $roleTitle,
            ], 404);
        }

        return response()->json([
            'success' => true,
            'role_title' => $statistics->role_title,
            'total_jobs_analyzed' => $statistics->total_jobs_analyzed,
            'top_skills' => $statistics->top_skills,
            'average_experience_years' => $statistics->average_experience_years,
            'common_locations' => $statistics->common_locations,
            'salary_range' => $statistics->salary_range,
            'last_updated' => $statistics->updated_at->diffForHumans(),
            'is_fresh' => $statistics->updated_at->diffInDays(now()) <= 7,
        ]);
    }

    /**
     * Get trending skills across all job roles.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function getTrendingSkills(Request $request)
    {
        $limit = $request->input('limit', 20);
        $skillType = $request->input('type'); // 'technical' or 'soft'

        // Aggregate skill frequency across all jobs
        $query = DB::table('job_skills')
            ->join('skills', 'job_skills.skill_id', '=', 'skills.id')
            ->select(
                'skills.id',
                'skills.name',
                'skills.type',
                DB::raw('COUNT(*) as demand_count'),
                DB::raw('AVG(job_skills.importance_score) as avg_importance'),
                DB::raw('MAX(job_skills.importance_category) as top_category')
            )
            ->groupBy('skills.id', 'skills.name', 'skills.type');

        // Filter by type if specified
        if ($skillType) {
            $query->where('skills.type', $skillType);
        }

        $trendingSkills = $query->orderBy('demand_count', 'DESC')
            ->limit($limit)
            ->get()
            ->map(function ($skill) {
                return [
                    'id' => $skill->id,
                    'name' => $skill->name,
                    'type' => $skill->type,
                    'demand_count' => $skill->demand_count,
                    'average_importance' => round($skill->avg_importance, 2),
                    'category' => $skill->top_category ?? 'nice_to_have',
                ];
            });

        return response()->json([
            'success' => true,
            'total_skills' => $trendingSkills->count(),
            'filter_type' => $skillType ?? 'all',
            'skills' => $trendingSkills,
        ]);
    }

    /**
     * Get skill demand breakdown for a specific job role.
     *
     * @param string $roleTitle
     * @return JsonResponse
     */
    public function getSkillDemand(string $roleTitle)
    {
        // Get all jobs matching the role
        $jobs = Job::where('title', 'like', "%{$roleTitle}%")
            ->with('skills')
            ->get();

        if ($jobs->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => "No jobs found for '{$roleTitle}'",
                'role_title' => $roleTitle,
            ], 404);
        }

        $totalJobs = $jobs->count();

        // Calculate skill demand
        $skillDemand = DB::table('job_skills')
            ->join('skills', 'job_skills.skill_id', '=', 'skills.id')
            ->whereIn('job_skills.job_id', $jobs->pluck('id'))
            ->select(
                'skills.id',
                'skills.name',
                'skills.type',
                DB::raw('COUNT(*) as occurrence_count'),
                DB::raw('AVG(job_skills.importance_score) as avg_importance_score'),
                'job_skills.importance_category'
            )
            ->groupBy('skills.id', 'skills.name', 'skills.type', 'job_skills.importance_category')
            ->get()
            ->map(function ($skill) use ($totalJobs) {
                $percentage = ($skill->occurrence_count / $totalJobs) * 100;
                return [
                    'id' => $skill->id,
                    'name' => $skill->name,
                    'type' => $skill->type,
                    'occurrence_count' => $skill->occurrence_count,
                    'percentage' => round($percentage, 2),
                    'importance_score' => round($skill->avg_importance_score ?? 0, 2),
                    'importance_category' => $skill->importance_category ?? 'nice_to_have',
                ];
            })
            ->sortByDesc('percentage')
            ->values();

        // Categorize skills
        $essential = $skillDemand->where('importance_category', 'essential')->values();
        $important = $skillDemand->where('importance_category', 'important')->values();
        $niceToHave = $skillDemand->where('importance_category', 'nice_to_have')->values();

        return response()->json([
            'success' => true,
            'role_title' => $roleTitle,
            'total_jobs_analyzed' => $totalJobs,
            'total_unique_skills' => $skillDemand->count(),
            'skills_by_category' => [
                'essential' => $essential,
                'important' => $important,
                'nice_to_have' => $niceToHave,
            ],
            'all_skills' => $skillDemand,
        ]);
    }

    /**
     * Get market overview statistics.
     *
     * @return JsonResponse
     */
    public function getMarketOverview()
    {
        $totalJobs = Job::count();
        $totalRoles = Job::distinct('title')->count('title');
        $avgSkillsPerJob = DB::table('job_skills')
            ->select(DB::raw('AVG(skills_count) as avg'))
            ->from(DB::raw('(SELECT job_id, COUNT(*) as skills_count FROM job_skills GROUP BY job_id) as subquery'))
            ->value('avg');

        $lastUpdated = Job::latest('updated_at')->value('updated_at');

        // Top 5 most in-demand skills
        $topSkills = DB::table('job_skills')
            ->join('skills', 'job_skills.skill_id', '=', 'skills.id')
            ->select('skills.name', DB::raw('COUNT(*) as count'))
            ->groupBy('skills.name')
            ->orderBy('count', 'DESC')
            ->limit(5)
            ->get();

        return response()->json([
            'success' => true,
            'overview' => [
                'total_jobs' => $totalJobs,
                'total_roles' => $totalRoles,
                'average_skills_per_job' => round($avgSkillsPerJob ?? 0, 1),
                'last_data_update' => $lastUpdated ? $lastUpdated->diffForHumans() : 'Never',
            ],
            'top_skills' => $topSkills,
        ]);
    }
}
