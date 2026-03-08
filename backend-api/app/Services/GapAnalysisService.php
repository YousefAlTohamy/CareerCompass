<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Job;
use App\Models\Skill;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class GapAnalysisService
{
    /**
     * Perform weighted gap analysis between a user and a job.
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
        $criticalSkills   = $missingSkillsArr->filter(fn($s) => ($s['importance_score'] ?? 0) > 60)->values();
        $niceToHaveSkills = $missingSkillsArr->filter(fn($s) => ($s['importance_score'] ?? 0) <= 60)->values();

        // Legacy category breakdown
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
     * Get recommendations efficiently mapped via a single DB query.
     *
     * @param User $user
     * @return array<string, mixed>
     */
    public function getRecommendations(User $user): array
    {
        $userSkillIds = $user->skills->pluck('id')->toArray();
        $totalJobs    = Job::count();

        $query = DB::table('skills')
            ->join('job_skill', 'skills.id', '=', 'job_skill.skill_id');

        if (!empty($userSkillIds)) {
            $query->whereNotIn('skills.id', $userSkillIds);
        }

        // DB level aggregation: Avoids pulling all Jobs and their skills into PHP memory
        $missingSkillsAgg = $query->select('skills.id', 'skills.name', 'skills.type', DB::raw('COUNT(job_skill.job_id) as demand'))
            ->groupBy('skills.id', 'skills.name', 'skills.type')
            ->orderByDesc('demand')
            ->get();

        $skillDemand = collect($missingSkillsAgg)->map(function ($skill) use ($totalJobs) {
            return [
                'id'       => $skill->id,
                'name'     => $skill->name,
                'type'     => $skill->type,
                'demand'   => (int) $skill->demand,
                'priority' => $this->calculatePriority((int) $skill->demand, $totalJobs),
            ];
        });

        $critical   = $skillDemand->where('priority', 'Critical')->take(5)->values();
        $important  = $skillDemand->where('priority', 'Important')->take(5)->values();
        $niceToHave = $skillDemand->where('priority', 'Nice-to-Have')->take(5)->values();

        Log::info('Recommendations generated via DB aggregation', [
            'user_id'               => $user->id,
            'total_recommendations' => $skillDemand->count(),
        ]);

        return [
            'user_skills_count'   => count($userSkillIds),
            'total_jobs_analyzed' => $totalJobs,
            'recommendations'     => [
                'critical'     => $critical,
                'important'    => $important,
                'nice_to_have' => $niceToHave,
            ],
            'top_20_skills' => $skillDemand->take(20)->values(),
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
     * Calculate priority based on market demand frequency.
     */
    private function calculatePriority(int $demand, int $totalJobs): string
    {
        $percentage = $totalJobs > 0 ? ($demand / $totalJobs) * 100 : 0;

        if ($percentage >= 50) return 'Critical';
        if ($percentage >= 25) return 'Important';
        return 'Nice-to-Have';
    }
}
