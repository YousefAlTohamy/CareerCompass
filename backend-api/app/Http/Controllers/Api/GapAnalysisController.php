<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CvAnalysisResource;
use App\Http\Resources\GapAnalysisResource;
use App\Models\Job;
use App\Models\User;
use App\Services\Contracts\GapAnalysisServiceInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class GapAnalysisController extends Controller
{
    private GapAnalysisServiceInterface $gapAnalysisService;

    public function __construct(GapAnalysisServiceInterface $gapAnalysisService)
    {
        $this->gapAnalysisService = $gapAnalysisService;
    }

    /**
     * Analyze skill gap for a specific job.
     * Persists the job title and extracted skills to the user's profile.
     * Includes cv_analysis (strengths, gaps, red_flags) from the user's persisted CvAnalysis when available.
     */
    public function analyzeJob(int $jobId): JsonResponse
    {
        try {
            /** @var User $user */
            $user = auth()->user();

            // Get job with skills
            $job = Job::with('skills')->find($jobId);

            if (!$job) {
                return response()->json([
                    'success' => false,
                    'message' => 'Job not found',
                ], 404);
            }

            // Perform gap analysis (user skills vs job skills)
            $analysis = $this->gapAnalysisService->performGapAnalysis($user, $job);

            // Include CvAnalysis data from DB (saved during CV upload); null if user hasn't uploaded CV
            $analysis['cv_analysis'] = $user->cvAnalysis;

            // ── Persist headline from the current job if not already set ────────
            // The primary source is /parse-cv (CvController). Fallback: seed from analyzed job.
            if (empty($user->job_title) && auth('sanctum')->check()) {
                $authUser = auth('sanctum')->user();
                $authProfile = $authUser->profile()->firstOrCreate([], []);
                $authProfile->update(['headline' => $job->title]);
                $user->refresh();
            }

            // ── Persist matched skills + recommended jobs ─────────────────────
            $detectedTitle = $user->job_title ?? $job->title;
            $this->gapAnalysisService->persistUserProfile($user, $detectedTitle, $analysis['matched_skills']);

            // ── Recommended jobs based on detected title ─────────────────────
            $recommendedJobs = $this->gapAnalysisService->findRecommendedJobs($detectedTitle, $jobId);

            $analysis['recommended_jobs'] = $recommendedJobs;

            Log::info('Gap analysis performed', [
                'user_id'          => $user->id,
                'job_id'           => $jobId,
                'match_percentage' => $analysis['match_percentage'],
                'recommended_jobs' => $recommendedJobs->count(),
            ]);

            return response()->json([
                'success' => true,
                'data'    => new GapAnalysisResource($analysis),
            ]);
        } catch (\Exception $e) {
            Log::error('Gap analysis failed', [
                'job_id' => $jobId,
                'error'  => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to perform gap analysis',
                'error'   => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * Analyze skill gaps for multiple jobs.
     */
    public function analyzeMultipleJobs(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'job_ids'   => 'required|array|min:1|max:20',
            'job_ids.*' => 'required|integer|exists:jobs,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors'  => $validator->errors(),
            ], 422);
        }

        try {
            /** @var User $user */
            $user = auth()->user();
            $jobIds = $request->input('job_ids');

            // Get jobs with skills
            $jobs = Job::with('skills')->whereIn('id', $jobIds)->get();

            $results = [];
            $totalMatchPercentage = 0;
            $bestMatch = null;
            $allMissingSkills = collect();

            foreach ($jobs as $job) {
                $analysis = $this->gapAnalysisService->performGapAnalysis($user, $job);

                $results[] = [
                    'job_id'               => $job->id,
                    'title'                => $job->title,
                    'company'              => $job->company,
                    'match_percentage'     => round($analysis['match_percentage'], 1),
                    'missing_skills_count' => $analysis['missing_count'],
                    'matched_skills_count' => $analysis['matched_count'],
                ];

                $totalMatchPercentage += $analysis['match_percentage'];

                if (!$bestMatch || $analysis['match_percentage'] > $bestMatch['percentage']) {
                    $bestMatch = [
                        'job_id'     => $job->id,
                        'title'      => $job->title,
                        'percentage' => round($analysis['match_percentage'], 1),
                    ];
                }

                // Collect all missing skills
                foreach ($analysis['missing_skills'] as $skill) {
                    $allMissingSkills->push($skill);
                }
            }

            // Sort results by match percentage (descending)
            usort($results, fn($a, $b) => $b['match_percentage'] <=> $a['match_percentage']);

            // Find common missing skills
            $missingSkillFrequency = $allMissingSkills->groupBy('id')->map(function ($skills) {
                return [
                    'id'        => $skills->first()['id'],
                    'name'      => $skills->first()['name'],
                    'type'      => $skills->first()['type'],
                    'frequency' => $skills->count(),
                ];
            })->sortByDesc('frequency')->values();

            $averageMatch = count($jobs) > 0 ? $totalMatchPercentage / count($jobs) : 0;

            Log::info('Batch gap analysis completed', [
                'user_id'       => $user->id,
                'jobs_analyzed' => count($jobs),
                'average_match' => $averageMatch,
            ]);

            return response()->json([
                'success' => true,
                'data'    => [
                    'analyzed_jobs'            => count($jobs),
                    'jobs'                     => $results,
                    'common_missing_skills'    => $missingSkillFrequency->take(20),
                    'average_match_percentage' => round($averageMatch, 1),
                    'best_match'               => $bestMatch,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Batch gap analysis failed', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to perform batch analysis',
                'error'   => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * Get the authenticated user's CV analysis (strengths, gaps, red_flags, completeness_score).
     * Data is persisted by CvProcessingService during CV upload. Returns 404 if no CV has been uploaded.
     *
     * GET /user/cv-analysis
     */
    public function getCvAnalysis(): JsonResponse
    {
        /** @var User $user */
        $user = auth()->user();

        $cvAnalysis = $user->cvAnalysis;

        if (!$cvAnalysis) {
            return response()->json([
                'success' => false,
                'message' => 'No CV analysis found. Please upload your CV first.',
                'data'    => null,
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data'    => new CvAnalysisResource($cvAnalysis),
        ]);
    }

    /**
     * Get personalized skill recommendations.
     */
    public function getRecommendations(): JsonResponse
    {
        try {
            /** @var User $user */
            $user = auth()->user();

            $data = $this->gapAnalysisService->getRecommendations($user);

            return response()->json([
                'success' => true,
                'data'    => $data,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate recommendations',
                'error'   => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * Analyze skill gap against a specific TargetJobRole (Phase 3 Integration).
     *
     * GET /api/gap-analysis/role/{role_id}
     */
    public function analyzeRole(int $roleId): JsonResponse
    {
        try {
            /** @var User $user */
            $user = auth()->user();

            $targetRole = \App\Models\TargetJobRole::find($roleId);

            if (!$targetRole) {
                return response()->json([
                    'success' => false,
                    'message' => 'Target Job Role not found',
                ], 404);
            }

            $analysis = $this->gapAnalysisService->analyzeTargetRole($user, $targetRole);

            return response()->json([
                'success' => true,
                'data'    => collect($analysis)->except('job'),
            ]);
        } catch (\Exception $e) {
            Log::error('Target role gap analysis failed', [
                'role_id' => $roleId,
                'error'   => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to perform role gap analysis',
                'error'   => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }
}
