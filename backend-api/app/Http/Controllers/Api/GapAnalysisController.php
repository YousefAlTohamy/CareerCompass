<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\GapAnalysisResource;
use App\Models\Job;
use App\Models\Skill;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class GapAnalysisController extends Controller
{
    /**
     * Analyze skill gap for a specific job.
     * Also persists the job title and extracted skills to the user's profile.
     */
    public function analyzeJob(int $jobId): JsonResponse
    {
        try {
            $user = auth()->user();

            // Get job with skills
            $job = Job::with('skills')->find($jobId);

            if (!$job) {
                return response()->json([
                    'success' => false,
                    'message' => 'Job not found',
                ], 404);
            }

            // Perform gap analysis
            $analysis = $this->performGapAnalysis($user, $job);

            // ── Persist job_title from the current job if not already set ────────
            // The primary source of job_title is /parse-cv (CvController).
            // This is a fallback: if the user analysed a job before uploading a CV,
            // we seed job_title from the job being analysed using the Sanctum guard.
            if (empty($user->job_title) && auth('sanctum')->check()) {
                auth('sanctum')->user()->update([
                    'job_title' => $job->title,
                ]);
                $user->refresh(); // reload so $detectedTitle picks up the new value
            }

            // ── Persist matched skills + recommended jobs ─────────────────────
            $detectedTitle = $user->job_title ?? $job->title;
            $this->persistUserProfile($user, $detectedTitle, $analysis['matched_skills']);

            // ── Recommended jobs based on detected title ─────────────────────
            $recommendedJobs = $this->findRecommendedJobs($detectedTitle, $jobId);

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
            'job_ids' => 'required|array|min:1|max:20',
            'job_ids.*' => 'required|integer|exists:jobs,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $user = auth()->user();
            $jobIds = $request->input('job_ids');

            // Get jobs with skills
            $jobs = Job::with('skills')->whereIn('id', $jobIds)->get();

            $results = [];
            $totalMatchPercentage = 0;
            $bestMatch = null;
            $allMissingSkills = collect();

            foreach ($jobs as $job) {
                $analysis = $this->performGapAnalysis($user, $job);

                $results[] = [
                    'job_id' => $job->id,
                    'title' => $job->title,
                    'company' => $job->company,
                    'match_percentage' => round($analysis['match_percentage'], 1),
                    'missing_skills_count' => $analysis['missing_count'],
                    'matched_skills_count' => $analysis['matched_count'],
                ];

                $totalMatchPercentage += $analysis['match_percentage'];

                if (!$bestMatch || $analysis['match_percentage'] > $bestMatch['percentage']) {
                    $bestMatch = [
                        'job_id' => $job->id,
                        'title' => $job->title,
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
                    'id' => $skills->first()->id,
                    'name' => $skills->first()->name,
                    'type' => $skills->first()->type,
                    'frequency' => $skills->count(),
                ];
            })->sortByDesc('frequency')->values();

            $averageMatch = count($jobs) > 0 ? $totalMatchPercentage / count($jobs) : 0;

            Log::info('Batch gap analysis completed', [
                'user_id' => $user->id,
                'jobs_analyzed' => count($jobs),
                'average_match' => $averageMatch,
            ]);

            return response()->json([
                'success' => true,
                'data' => [
                    'analyzed_jobs' => count($jobs),
                    'jobs' => $results,
                    'common_missing_skills' => $missingSkillFrequency->take(20),
                    'average_match_percentage' => round($averageMatch, 1),
                    'best_match' => $bestMatch,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Batch gap analysis failed', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to perform batch analysis',
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * Get personalized skill recommendations.
     */
    public function getRecommendations(): JsonResponse
    {
        try {
            $user = auth()->user();
            $userSkillIds = $user->skills->pluck('id');

            // Get all jobs
            $jobs = Job::with('skills')->get();

            // Collect all required skills from jobs
            $allJobSkills = collect();
            foreach ($jobs as $job) {
                foreach ($job->skills as $skill) {
                    $allJobSkills->push($skill);
                }
            }

            // Find skills user doesn't have
            $missingSkills = $allJobSkills->whereNotIn('id', $userSkillIds);

            // Count frequency (market demand)
            $skillDemand = $missingSkills->groupBy('id')->map(function ($skills) {
                $skill = $skills->first();
                return [
                    'id' => $skill->id,
                    'name' => $skill->name,
                    'type' => $skill->type,
                    'demand' => $skills->count(),
                    'priority' => $this->calculatePriority($skills->count(), count($skills)),
                ];
            })->sortByDesc('demand')->values();

            // Categorize by priority
            $critical = $skillDemand->where('priority', 'Critical')->take(5);
            $important = $skillDemand->where('priority', 'Important')->take(5);
            $niceToHave = $skillDemand->where('priority', 'Nice-to-Have')->take(5);

            Log::info('Recommendations generated', [
                'user_id' => $user->id,
                'total_recommendations' => $skillDemand->count(),
            ]);

            return response()->json([
                'success' => true,
                'data' => [
                    'user_skills_count' => $userSkillIds->count(),
                    'total_jobs_analyzed' => $jobs->count(),
                    'recommendations' => [
                        'critical' => $critical,
                        'important' => $important,
                        'nice_to_have' => $niceToHave,
                    ],
                    'top_20_skills' => $skillDemand->take(20),
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Recommendations failed', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to generate recommendations',
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * Persist the CV-extracted job title and matched skills to the user's profile.
     *
     * - Saves job_title to the users.job_title column.
     * - Syncs extracted skills into the user_skills pivot table.
     *   Skills that don't exist in the skills table are created on-the-fly.
     */
    private function persistUserProfile($user, ?string $jobTitle, $matchedSkills): void
    {
        try {
            // Persist job title
            if ($jobTitle) {
                $user->update(['job_title' => $jobTitle]);
            }

            // Sync extracted (matched) skills into user_skills
            if ($matchedSkills && count($matchedSkills) > 0) {
                $skillIds = [];

                foreach ($matchedSkills as $skillData) {
                    $name = is_array($skillData) ? ($skillData['name'] ?? null) : null;
                    $type = is_array($skillData) ? ($skillData['type'] ?? 'technical') : 'technical';

                    if (!$name) continue;

                    // Find or create the skill record
                    $skill = Skill::firstOrCreate(
                        ['name' => $name],
                        ['type' => $type]
                    );

                    $skillIds[] = $skill->id;
                }

                // Sync without detaching existing skills (union merge)
                if (!empty($skillIds)) {
                    $user->skills()->syncWithoutDetaching($skillIds);
                }
            }

            Log::info('User profile persisted from CV analysis', [
                'user_id'   => $user->id,
                'job_title' => $jobTitle,
                'skills_synced' => count($matchedSkills ?? []),
            ]);
        } catch (\Exception $e) {
            // Non-fatal — log but don't break the main analysis response
            Log::warning('Failed to persist user profile', [
                'user_id' => $user->id,
                'error'   => $e->getMessage(),
            ]);
        }
    }

    /**
     * Find recommended jobs that match the detected job title.
     * Excludes the current job being analyzed.
     *
     * Returns up to 6 matching jobs ordered by most recent.
     */
    private function findRecommendedJobs(?string $jobTitle, int $excludeJobId)
    {
        if (!$jobTitle) {
            return collect();
        }

        // Strip seniority prefixes to broaden the LIKE search
        // e.g. "Senior Backend Developer" → "Backend Developer"
        $cleanTitle = preg_replace(
            '/^(senior|junior|lead|principal|associate|mid[- ]?level)\s+/i',
            '',
            trim($jobTitle)
        );

        // Try to extract the core keyword (e.g. "Backend Developer", "React Developer")
        // Use the first two words of the clean title for a broader match
        $words  = explode(' ', $cleanTitle);
        $keyword = implode(' ', array_slice($words, 0, 2));

        $jobs = Job::where('id', '!=', $excludeJobId)
            ->where(function ($query) use ($keyword, $cleanTitle) {
                $query->where('title', 'LIKE', '%' . $keyword . '%')
                    ->orWhere('title', 'LIKE', '%' . $cleanTitle . '%');
            })
            ->latest()
            ->take(20)
            ->get(['id', 'title', 'company', 'location', 'source', 'url', 'job_type', 'salary_range']);

        Log::info('Recommended jobs fetched', [
            'keyword'  => $keyword,
            'count'    => $jobs->count(),
        ]);

        return $jobs;
    }

    /**
     * Perform weighted gap analysis between a user and a job.
     *
     * - Uses fuzzy skill name matching (normalizeSkillName) to catch variants like Vue.js vs VueJS.
     * - Calculates match_percentage using importance_score weights so high-importance skills
     *   carry more weight than low-importance ones.
     * - Splits missing skills into critical_skills (importance > 60) and nice_to_have_skills (≤ 60).
     */
    private function performGapAnalysis($user, Job $job): array
    {
        $userSkills   = $user->skills;
        $userSkillIds = $userSkills->pluck('id');
        $jobSkills    = $job->skills; // has pivot: importance_score, importance_category

        $totalRequired = $jobSkills->count();
        if ($totalRequired === 0) {
            return [
                'job'                         => $job,
                'match_percentage'            => 100.0,
                'total_required'              => 0,
                'matched_count'               => 0,
                'missing_count'               => 0,
                'matched_skills'              => collect(),
                'missing_skills'              => collect(),
                'critical_skills'             => collect(),
                'nice_to_have_skills'         => collect(),
                'missing_essential_skills'    => collect(),
                'missing_important_skills'    => collect(),
                'missing_nice_to_have_skills' => collect(),
                'technical_required'          => 0,
                'technical_matched'           => 0,
                'soft_required'               => 0,
                'soft_matched'                => 0,
                'recommendations'             => [
                    'This job listing has no specific skill requirements listed.',
                    'Consider reviewing the full job description for details.',
                ],
            ];
        }

        // ── Fuzzy matching: matched vs missing ────────────────────────────────
        $matchedJobSkills  = collect();
        $missingJobSkills  = collect();

        foreach ($jobSkills as $jobSkill) {
            $matched = false;

            // 1. Exact ID match (fast path)
            if ($userSkillIds->contains($jobSkill->id)) {
                $matched = true;
            }

            // 2. Fuzzy name match (catches Vue.js vs VueJS, Node vs Node.js, etc.)
            if (!$matched) {
                $normJobName = $this->normalizeSkillName($jobSkill->name);
                foreach ($userSkills as $uSkill) {
                    if ($this->normalizeSkillName($uSkill->name) === $normJobName) {
                        $matched = true;
                        break;
                    }
                }
            }

            if ($matched) {
                $matchedJobSkills->push($jobSkill);
            } else {
                $missingJobSkills->push($jobSkill);
            }
        }

        // ── Build structured skill arrays ─────────────────────────────────────
        $toSkillArray = function ($skill) {
            return [
                'id'                  => $skill->id,
                'name'                => $skill->name,
                'type'                => $skill->type,
                'importance_score'    => $skill->pivot->importance_score ?? 50,
                'importance_category' => $skill->pivot->importance_category ?? 'nice_to_have',
            ];
        };

        $matchedSkillsArr  = $matchedJobSkills->map($toSkillArray);
        $missingSkillsArr  = $missingJobSkills->map($toSkillArray);

        // ── Weighted match percentage ──────────────────────────────────────────
        $totalWeight   = $jobSkills->sum(fn($s) => $s->pivot->importance_score ?? 50);
        $matchedWeight = $matchedSkillsArr->sum('importance_score');

        $matchPercentage = $totalWeight > 0
            ? min(100, ($matchedWeight / $totalWeight) * 100)
            : ($totalRequired > 0 ? ($matchedJobSkills->count() / $totalRequired) * 100 : 0);

        $matchPercentage = round($matchPercentage, 2);

        // ── Categorise missing skills ──────────────────────────────────────────
        // Phase 1 split: critical (>60) vs nice-to-have (≤60)
        $criticalSkills  = $missingSkillsArr->filter(fn($s) => ($s['importance_score'] ?? 0) > 60)->values();
        $niceToHaveSkills = $missingSkillsArr->filter(fn($s) => ($s['importance_score'] ?? 0) <= 60)->values();

        // Legacy category breakdown (kept for backward compatibility)
        $missingEssential  = $missingSkillsArr->where('importance_category', 'essential')->values();
        $missingImportant  = $missingSkillsArr->where('importance_category', 'important')->values();
        $missingNiceToHave = $missingSkillsArr->where('importance_category', 'nice_to_have')->values();

        // ── Breakdown by skill type ───────────────────────────────────────────
        $technicalRequired = $jobSkills->where('type', 'technical')->count();
        $technicalMatched  = $matchedSkillsArr->where('type', 'technical')->count();
        $softRequired      = $jobSkills->where('type', 'soft')->count();
        $softMatched       = $matchedSkillsArr->where('type', 'soft')->count();

        // ── Recommendations ───────────────────────────────────────────────────
        $recommendations = $this->generateRecommendations(
            $matchPercentage,
            $missingSkillsArr,
            $missingEssential,
            $missingImportant
        );

        return [
            'job'                         => $job,
            'match_percentage'            => $matchPercentage,
            'total_required'              => $totalRequired,
            'matched_count'               => $matchedJobSkills->count(),
            'missing_count'               => $missingJobSkills->count(),
            'matched_skills'              => $matchedSkillsArr,
            'missing_skills'              => $missingSkillsArr,
            'critical_skills'             => $criticalSkills,       // Phase 1: importance > 60
            'nice_to_have_skills'         => $niceToHaveSkills,     // Phase 1: importance ≤ 60
            'missing_essential_skills'    => $missingEssential,
            'missing_important_skills'    => $missingImportant,
            'missing_nice_to_have_skills' => $missingNiceToHave,
            'technical_required'          => $technicalRequired,
            'technical_matched'           => $technicalMatched,
            'soft_required'               => $softRequired,
            'soft_matched'               => $softMatched,
            'recommendations'             => $recommendations,
        ];
    }

    /**
     * Normalize a skill name for fuzzy comparison.
     * "Vue.js" → "vuejs"  |  "Node.JS" → "nodejs"  |  "React" → "react"
     */
    private function normalizeSkillName(string $name): string
    {
        $name = mb_strtolower(trim($name));
        $name = preg_replace('/[\.\-_\s]/', '', $name); // remove dots, dashes, spaces
        return $name;
    }

    /**
     * Generate recommendations based on analysis.
     */
    private function generateRecommendations(
        float $matchPercentage,
        $allMissingSkills,
        $missingEssential,
        $missingImportant
    ): array {
        $recommendations = [];

        if ($matchPercentage >= 90) {
            $recommendations[] = "🚀 Excellent match! Apply with full confidence.";
        } elseif ($matchPercentage >= 75) {
            $recommendations[] = "👍 Good match! Address a few skill gaps and you're ready to apply.";
        } elseif ($matchPercentage >= 60) {
            $recommendations[] = "📈 Fair match. Focus on the critical skills listed below before applying.";
        } elseif ($matchPercentage >= 40) {
            $recommendations[] = "🎯 Moderate gap. Invest 1-2 months in the top missing skills.";
        } else {
            $recommendations[] = "🛠️ Large gap. Build a structured learning plan starting with foundational skills.";
        }

        if ($missingEssential->count() > 0) {
            $essentialSkills   = $missingEssential->pluck('name')->take(3)->join(', ');
            $recommendations[] = "🔴 Priority #1 – Essential: Learn {$essentialSkills} (required by 70%+ of similar jobs).";
        }

        if ($missingImportant->count() > 0) {
            $importantSkills   = $missingImportant->pluck('name')->take(3)->join(', ');
            $recommendations[] = "🟡 Priority #2 – Important: {$importantSkills} (required by 40-70% of jobs).";
        }

        $missingSoftSkills = $allMissingSkills->where('type', 'soft');
        if ($missingSoftSkills->count() > 0) {
            $softSkillNames    = $missingSoftSkills->pluck('name')->take(2)->join(', ');
            $recommendations[] = "💼 Soft skills: Develop {$softSkillNames} to stand out.";
        }

        return $recommendations;
    }

    /**
     * Calculate priority based on market demand frequency.
     */
    private function calculatePriority(int $demand, int $totalJobs): string
    {
        $percentage = ($demand / max($totalJobs, 1)) * 100;

        if ($percentage >= 50) return 'Critical';
        if ($percentage >= 25) return 'Important';
        return 'Nice-to-Have';
    }
}
