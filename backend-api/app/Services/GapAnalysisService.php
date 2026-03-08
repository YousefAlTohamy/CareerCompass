<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Job;
use App\Models\Skill;
use App\Models\User;
use App\Services\Contracts\GapAnalysisServiceInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class GapAnalysisService implements GapAnalysisServiceInterface
{
    /**
     * Perform weighted gap analysis between a user and a job.
     * Specific Job Gap Analysis.
     *
     * @param User $user
     * @param Job $job
     * @return array<string, mixed>
     */
    public function performGapAnalysis(User $user, Job $job): array
    {
        $userSkills   = $user->skills;
        $userSkillIds = $userSkills->pluck('id');
        $jobSkills    = $job->skills;

        $totalRequired = $jobSkills->count();
        if ($totalRequired === 0) {
            return [
                'job'                         => $job,
                'match_percentage'            => 0,
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

            // 2. Fuzzy name match
            if (!$matched) {
                $normJobName = $this->normalizeSkillName((string) $jobSkill->name);
                foreach ($userSkills as $uSkill) {
                    if ($this->normalizeSkillName((string) $uSkill->name) === $normJobName) {
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
            $cat = mb_strtolower($skill->pivot->importance_category ?? 'nice_to_have');
            // normalize category names
            if (in_array($cat, ['high', 'critical'])) $cat = 'essential';
            if (in_array($cat, ['medium'])) $cat = 'important';
            if (in_array($cat, ['low'])) $cat = 'nice_to_have';

            return [
                'id'                  => $skill->id,
                'name'                => $skill->name,
                'type'                => $skill->type,
                'importance_score'    => $skill->pivot->importance_score ?? 50,
                'importance_category' => $cat,
            ];
        };

        $matchedSkillsArr  = $matchedJobSkills->map($toSkillArray);
        $missingSkillsArr  = $missingJobSkills->map($toSkillArray);

        // ── Smart Weighted match percentage ──────────────────────────────────────
        $getWeight = function ($category) {
            $category = strtolower($category ?? '');
            if (in_array($category, ['essential', 'critical', 'high'])) return 5;
            if (in_array($category, ['important', 'medium'])) return 3;
            return 1; // nice_to_have, low, or default
        };

        // Edge case: zero intersection
        if ($matchedJobSkills->count() === 0) {
            $matchPercentage = 0;
        } else {
            $totalWeight = $jobSkills->sum(fn($s) => $getWeight($s->pivot->importance_category ?? 'nice_to_have'));
            $matchedWeight = $matchedSkillsArr->sum(fn($s) => $getWeight($s['importance_category'] ?? 'nice_to_have'));

            $matchPercentage = $totalWeight > 0
                ? min(100, ($matchedWeight / $totalWeight) * 100)
                : ($totalRequired > 0 ? ($matchedJobSkills->count() / $totalRequired) * 100 : 0);
        }

        $matchPercentage = round((float)$matchPercentage, 2);

        // Sort missing skills by importance (Essential > Important > Nice-to-have)
        $missingSkillsArr = collect($missingSkillsArr)->sortByDesc(fn($s) => $getWeight($s['importance_category']))->values();

        // ── Categorise missing skills ──────────────────────────────────────────
        $criticalSkills   = $missingSkillsArr->filter(fn($s) => ($s['importance_score'] ?? 0) > 60)->values();
        $niceToHaveSkills = $missingSkillsArr->filter(fn($s) => ($s['importance_score'] ?? 0) <= 60)->values();

        // Legacy category breakdown
        $missingEssential  = collect($missingSkillsArr)->where('importance_category', 'essential')->values();
        $missingImportant  = collect($missingSkillsArr)->where('importance_category', 'important')->values();
        $missingNiceToHave = collect($missingSkillsArr)->whereNotIn('importance_category', ['essential', 'important'])->values();

        // ── Breakdown by skill type ───────────────────────────────────────────
        $technicalRequired = $jobSkills->where('type', 'technical')->count();
        $technicalMatched  = $matchedSkillsArr->where('type', 'technical')->count();
        $softRequired      = $jobSkills->where('type', 'soft')->count();
        $softMatched       = $matchedSkillsArr->where('type', 'soft')->count();

        // ── Recommendations ───────────────────────────────────────────────────
        $recommendations = $this->generateRecommendations(
            $matchPercentage,
            collect($missingSkillsArr),
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
            'missing_skills'              => $missingSkillsArr, // Sorted array
            'critical_skills'             => $criticalSkills,
            'nice_to_have_skills'         => $niceToHaveSkills,
            'missing_essential_skills'    => $missingEssential,
            'missing_important_skills'    => $missingImportant,
            'missing_nice_to_have_skills' => $missingNiceToHave,
            'technical_required'          => $technicalRequired,
            'technical_matched'           => $technicalMatched,
            'soft_required'               => $softRequired,
            'soft_matched'                => $softMatched,
            'recommendations'             => $recommendations,
        ];
    }

    /**
     * Persist the CV-extracted job title and matched skills to the user's profile.
     *
     * @param User $user
     * @param string|null $jobTitle
     * @param iterable|mixed $matchedSkills
     */
    public function persistUserProfile(User $user, ?string $jobTitle, $matchedSkills): void
    {
        try {
            if ($jobTitle) {
                $user->update(['job_title' => $jobTitle]);
            }

            if ($matchedSkills && (is_array($matchedSkills) || $matchedSkills instanceof \Countable) && count($matchedSkills) > 0) {
                $skillIds = [];

                foreach ($matchedSkills as $skillData) {
                    $name = is_array($skillData) ? ($skillData['name'] ?? null) : null;
                    if (!$name) {
                        $name = isset($skillData->name) ? $skillData->name : (isset($skillData['name']) ? $skillData['name'] : null);
                    }

                    $type = is_array($skillData) ? ($skillData['type'] ?? 'technical') : 'technical';
                    if (is_object($skillData) && isset($skillData->type)) {
                        $type = $skillData->type;
                    } elseif (is_array($skillData) && isset($skillData['type'])) {
                        $type = $skillData['type'];
                    }

                    if (!$name) continue;

                    $skill = Skill::firstOrCreate(
                        ['name' => $name],
                        ['type' => $type]
                    );

                    $skillIds[] = $skill->id;
                }

                if (!empty($skillIds)) {
                    $user->skills()->syncWithoutDetaching($skillIds);
                }
            }

            Log::info('User profile persisted from CV analysis', [
                'user_id'       => $user->id,
                'job_title'     => $jobTitle,
                'skills_synced' => (is_array($matchedSkills) || $matchedSkills instanceof \Countable) ? count($matchedSkills) : 0,
            ]);
        } catch (\Exception $e) {
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
     * @param string|null $jobTitle
     * @param int $excludeJobId
     * @return Collection|\Illuminate\Database\Eloquent\Collection
     */
    public function findRecommendedJobs(?string $jobTitle, int $excludeJobId)
    {
        if (!$jobTitle) {
            return collect();
        }

        $cleanTitle = preg_replace(
            '/^(senior|junior|lead|principal|associate|mid[- ]?level)\s+/i',
            '',
            trim($jobTitle)
        );

        $words   = explode(' ', (string) $cleanTitle);
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
            'keyword' => $keyword,
            'count'   => $jobs->count(),
        ]);

        return $jobs;
    }

    /**
     * Get similar jobs for the user based on job_title.
     * Used for Global Gap Analysis.
     */
    private function getSimilarJobsForUser(User $user): Collection
    {
        $jobTitle = $user->job_title;
        if (!$jobTitle) {
            return collect();
        }

        $cleanTitle = preg_replace(
            '/^(senior|junior|lead|principal|associate|mid[- ]?level)\s+/i',
            '',
            trim($jobTitle)
        );

        $words   = explode(' ', (string) $cleanTitle);
        $keyword = implode(' ', array_slice($words, 0, 2));

        // Load jobs and their skills
        return Job::with('skills')->where(function ($query) use ($keyword, $cleanTitle) {
            $query->where('title', 'LIKE', '%' . $keyword . '%')
                ->orWhere('title', 'LIKE', '%' . $cleanTitle . '%');
        })
            ->latest()
            ->take(50)
            ->get();
    }

    /**
     * Get recommendations (Global Gap Analysis).
     * Compares user's skills against aggregate market average of similar jobs.
     *
     * @param User $user
     * @return array<string, mixed>
     */
    public function getRecommendations(User $user): array
    {
        $userSkills = $user->skills;
        $userSkillsCount = $userSkills->count();
        $similarJobs = $this->getSimilarJobsForUser($user);
        $totalJobsAnalyzed = $similarJobs->count();

        if ($totalJobsAnalyzed === 0) {
            return [
                'user_skills_count'      => $userSkillsCount,
                'market_readiness_score' => 0,
                'total_jobs_analyzed'    => 0,
                'recommendations'        => [
                    'critical'     => collect(),
                    'important'    => collect(),
                    'nice_to_have' => collect(),
                ],
                'top_20_skills' => collect(),
                'matched_skills' => collect(),
                'missing_skills' => collect(),
            ];
        }

        $skillIdToJobCount = [];
        $skillMap = [];

        foreach ($similarJobs as $job) {
            foreach ($job->skills as $skill) {
                if (!isset($skillIdToJobCount[$skill->id])) {
                    $skillIdToJobCount[$skill->id] = 0;
                    $skillMap[$skill->id] = $skill;
                }
                $skillIdToJobCount[$skill->id]++;
            }
        }

        $getWeight = function ($category) {
            $cat = strtolower($category ?? '');
            if (in_array($cat, ['essential', 'critical', 'high'])) return 5;
            if (in_array($cat, ['important', 'medium'])) return 3;
            return 1;
        };

        $totalMarketWeight = 0;
        $matchedMarketWeight = 0;

        $globalMissingSkills = collect();
        $globalMatchedSkills = collect();

        foreach ($skillIdToJobCount as $skillId => $frequency) {
            $skill = $skillMap[$skillId];

            $matched = false;
            foreach ($userSkills as $uSkill) {
                if ($uSkill->id === $skill->id || $this->normalizeSkillName((string)$uSkill->name) === $this->normalizeSkillName((string)$skill->name)) {
                    $matched = true;
                    break;
                }
            }

            $catRaw = $skill->pivot->importance_category ?? 'nice_to_have';
            $weight = $getWeight($catRaw);
            $weightedImportance = $frequency * $weight;

            $totalMarketWeight += $weightedImportance;

            $cat = mb_strtolower($catRaw);
            if (in_array($cat, ['high', 'critical'])) $cat = 'essential';
            if (in_array($cat, ['medium'])) $cat = 'important';
            if (in_array($cat, ['low'])) $cat = 'nice_to_have';

            $structuredSkill = [
                'id' => $skill->id,
                'name' => $skill->name,
                'type' => $skill->type,
                'frequency' => $frequency,
                'weight' => $weight,
                'weighted_importance' => $weightedImportance,
                'importance_category' => $cat,
            ];

            if ($matched) {
                $matchedMarketWeight += $weightedImportance;
                $globalMatchedSkills->push($structuredSkill);
            } else {
                $globalMissingSkills->push($structuredSkill);
            }
        }

        $marketReadinessScore = $totalMarketWeight > 0
            ? round(($matchedMarketWeight / $totalMarketWeight) * 100)
            : 0;

        // Sort descending by weighted market importance
        $globalMissingSkills = $globalMissingSkills->sortByDesc('weighted_importance')->values();
        $globalMatchedSkills = $globalMatchedSkills->sortByDesc('weighted_importance')->values();

        $critical = $globalMissingSkills->where('importance_category', 'essential')->values();
        $important = $globalMissingSkills->where('importance_category', 'important')->values();
        $niceToHave = $globalMissingSkills->whereNotIn('importance_category', ['essential', 'important'])->values();

        Log::info('Global Map Analysis completed', [
            'user_id' => $user->id,
            'market_readiness_score' => $marketReadinessScore,
            'total_jobs_analyzed' => $totalJobsAnalyzed,
        ]);

        return [
            'user_skills_count'      => $userSkillsCount,
            'market_readiness_score' => $marketReadinessScore,
            'total_jobs_analyzed'    => $totalJobsAnalyzed,
            'recommendations'        => [
                'critical'     => $critical,
                'important'    => $important,
                'nice_to_have' => $niceToHave,
            ],
            'top_20_skills' => $globalMissingSkills->take(20)->values(), // top 20 missing
            'matched_skills' => $globalMatchedSkills,
            'missing_skills' => $globalMissingSkills,
        ];
    }

    /**
     * Normalize a skill name for fuzzy comparison.
     */
    private function normalizeSkillName(string $name): string
    {
        $name = mb_strtolower(trim($name));
        $name = preg_replace('/[\.\-_\s]/', '', $name);
        return (string) $name;
    }

    /**
     * Generate recommendations based on analysis.
     *
     * @param float $matchPercentage
     * @param Collection $allMissingSkills
     * @param Collection $missingEssential
     * @param Collection $missingImportant
     * @return array<int, string>
     */
    private function generateRecommendations(
        float $matchPercentage,
        Collection $allMissingSkills,
        Collection $missingEssential,
        Collection $missingImportant
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
     * Calculate priority based on market demand frequency. (Deprecated/Internal use)
     */
    private function calculatePriority(int $demand, int $totalJobs): string
    {
        $percentage = $totalJobs > 0 ? ($demand / $totalJobs) * 100 : 0;

        if ($percentage >= 50) return 'Critical';
        if ($percentage >= 25) return 'Important';
        return 'Nice-to-Have';
    }
}
