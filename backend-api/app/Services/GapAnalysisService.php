<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Job;
use App\Models\Skill;
use App\Models\User;
use App\Services\Contracts\GapAnalysisServiceInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Gap Analysis Service — Layer 3 Job Matching Engine
 *
 * Performs highly accurate job matching by leveraging:
 * - Canonical skills from user_skills + skills tables (no raw PDF parsing during match)
 * - Rich profile data (headline, summary, experiences) for semantic matching
 * - Python AI Layer 3 endpoint (semantic + TF-IDF skill overlap)
 *
 * Phase 12: Job Matching Engine Optimization — uses normalized DB data only.
 */
class GapAnalysisService implements GapAnalysisServiceInterface
{
    /**
     * AI Engine URL (Port 8002). All AI services consolidated here.
     */
    private string $gatewayUrl;

    private int $timeout;

    public function __construct()
    {
        $this->gatewayUrl = rtrim(config('services.ai_orchestrator.url', 'http://127.0.0.1:8002'), '/');
        $this->timeout    = (int) config('services.ai_cv_analyzer.timeout', 60);
    }

    /**
     * Perform weighted gap analysis between a user and a job.
     * Specific Job Gap Analysis.
     *
     * Uses Layer 3 AI matching when user has populated profile/skills.
     * NEVER re-parses PDF — uses canonical DB relations only.
     *
     * @param User $user
     * @param Job  $job
     * @return array<string, mixed>
     *
     * @throws RuntimeException When user has no profile data and no skills (must upload CV first)
     */
    public function performGapAnalysis(User $user, Job $job): array
    {
        // Ensure relations are loaded for payload construction
        $user->loadMissing(['profile', 'skills', 'experiences']);
        $job->loadMissing('requiredSkills');

        // ── Edge case: Job has no skill requirements ─────────────────────────
        if ($job->requiredSkills->isEmpty()) {
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

        // ── Edge case: User has no profile and no skills ─────────────────────
        if (!$this->userHasMatchableData($user)) {
            throw new RuntimeException(
                'No profile or skills found. Please upload your CV first to populate your profile and skills.'
            );
        }

        // ── Build ideal AI payload from normalized DB tables ─────────────────
        $payload = $this->buildLayer3Payload($user, $job);

        // ── Call Layer 3 matching API ───────────────────────────────────────
        $aiResult = $this->callLayer3MatchApi($payload);

        // ── Map AI response to GapAnalysisController / GapAnalysisResource format ─
        if ($aiResult !== null) {
            return $this->mapAiResponseToAnalysisFormat($aiResult, $job);
        }

        // ── Fallback: DB-based fuzzy matching when AI is unavailable ─────────
        Log::warning('Layer 3 match-job API unavailable; falling back to DB-based matching', [
            'user_id' => $user->id,
            'job_id'  => $job->id,
        ]);

        return $this->performDbBasedGapAnalysis($user, $job);
    }

    /**
     * Check if user has sufficient data for matching (profile or skills).
     * Prevents matching when user has never uploaded a CV or filled their profile.
     */
    private function userHasMatchableData(User $user): bool
    {
        $hasSkills = $user->skills->isNotEmpty();

        $profile = $user->profile;
        $hasProfileData = $profile
            && (trim((string) ($profile->headline ?? '')) !== '' || trim((string) ($profile->summary ?? '')) !== '');

        $hasExperiences = $user->experiences->isNotEmpty();

        return $hasSkills || $hasProfileData || $hasExperiences;
    }

    /**
     * Build the ideal Layer 3 payload from canonicalized, normalized DB data.
     *
     * Payload structure:
     * - cv_skills: Canonical skill names from user_skills relation (plucked from skills table)
     * - cv_text: Concatenation of headline + summary + all experience descriptions
     * - job_skills: Canonical skill names from job_skills pivot
     * - job_description: Raw job description text
     *
     * No PDF parsing occurs here; all data comes from the database.
     *
     * @return array{cv_skills: list<string>, cv_text: string, job_skills: list<string>, job_description: string}
     */
    private function buildLayer3Payload(User $user, Job $job): array
    {
        // cv_skills: pluck canonical skill names directly from user's skills relation
        $cvSkills = $user->skills()->pluck('name')->filter()->values()->toArray();

        // cv_text: concatenate rich profile data for semantic matching
        $cvTextParts = [];
        $profile = $user->profile;
        if ($profile) {
            if (trim((string) ($profile->headline ?? '')) !== '') {
                $cvTextParts[] = $profile->headline;
            }
            if (trim((string) ($profile->summary ?? '')) !== '') {
                $cvTextParts[] = $profile->summary;
            }
        }
        foreach ($user->experiences as $exp) {
            if (trim((string) ($exp->description ?? '')) !== '') {
                $cvTextParts[] = $exp->description;
            }
        }
        $cvText = implode("\n\n", $cvTextParts);

        // job_skills: canonical skill names from job's skills relation
        $jobSkills = $job->requiredSkills()->pluck('name')->filter()->values()->toArray();

        // job_description: raw description from Job model
        $jobDescription = trim((string) ($job->description ?? ''));

        return [
            'cv_skills'        => $cvSkills,
            'cv_text'          => $cvText,
            'job_skills'       => $jobSkills,
            'job_description'  => $jobDescription,
        ];
    }

    /**
     * Call the Python AI Layer 3 match-job endpoint.
     *
     * POST /api/hybrid-match
     * Request: { cv_text, cv_skills, job_description, job_skills }
     * Response: { hybrid_match_score, semantic_score, tfidf_score, missing_skills }
     *
     * @param array{cv_skills: list<string>, cv_text: string, job_skills: list<string>, job_description: string} $payload
     * @return array{hybrid_match_score: float, semantic_score: float, tfidf_score: float, missing_skills: list<string>}|null
     */
    private function callLayer3MatchApi(array $payload): ?array
    {
        $url = "{$this->gatewayUrl}/api/hybrid-match";

        try {
            $response = Http::timeout($this->timeout)
                ->connectTimeout(10)
                ->acceptJson()
                ->withHeaders($this->correlationHeaders())
                ->post($url, [
                    'cv_skills'       => $payload['cv_skills'],
                    'cv_text'         => $payload['cv_text'],
                    'job_description' => $payload['job_description'],
                    'job_skills'      => $payload['job_skills'],
                ]);

            if ($response->failed()) {
                Log::error('Layer 3 match-job API returned error', [
                    'status' => $response->status(),
                    'body'   => substr((string) $response->body(), 0, 500),
                ]);
                return null;
            }

            $data = $response->json();
            if (!is_array($data) || !isset($data['hybrid_match_score'])) {
                Log::warning('Layer 3 match-job API returned unexpected response', ['data' => $data]);
                return null;
            }

            return $data;
        } catch (\Throwable $e) {
            Log::error('Layer 3 match-job API request failed', [
                'url'   => $url,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Map the AI layer3_matching response into the format expected by GapAnalysisController / GapAnalysisResource.
     *
     * AI returns: hybrid_match_score, semantic_score, tfidf_score, missing_skills (list of skill names)
     * We must produce: full analysis array with job, match_percentage, matched_skills, missing_skills (full objects with pivot), etc.
     */
    private function mapAiResponseToAnalysisFormat(array $aiResponse, Job $job): array
    {
        $jobSkills = $job->requiredSkills;

        $matchPercentage = (float) ($aiResponse['hybrid_match_score'] ?? 0);
        $aiMissingNames  = array_map('strval', $aiResponse['missing_skills'] ?? []);

        // Build missing_skills: job skills whose names are in aiMissingNames
        $aiMissingLower   = array_map('mb_strtolower', $aiMissingNames);
        $missingJobSkills = $jobSkills->filter(fn($s) => in_array(mb_strtolower((string) $s->name), $aiMissingLower));
        $matchedJobSkills = $jobSkills->filter(fn($s) => !in_array(mb_strtolower((string) $s->name), $aiMissingLower));

        $totalRequired = $jobSkills->count();
        $toSkillArray  = function ($skill) {
            $cat = mb_strtolower($skill->pivot->importance_category ?? 'nice_to_have');
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

        $matchedSkillsArr  = $matchedJobSkills->map($toSkillArray)->values();
        $missingSkillsArr  = $missingJobSkills->map($toSkillArray)->values();

        $getWeight = function ($category) {
            $category = strtolower($category ?? '');
            if (in_array($category, ['essential', 'critical', 'high'])) return 5;
            if (in_array($category, ['important', 'medium'])) return 3;
            return 1;
        };

        $missingSkillsArr = $missingSkillsArr->sortByDesc(fn($s) => $getWeight($s['importance_category'] ?? 'nice_to_have'))->values();

        $criticalSkills   = $missingSkillsArr->filter(fn($s) => ($s['importance_score'] ?? 0) > 60)->values();
        $niceToHaveSkills = $missingSkillsArr->filter(fn($s) => ($s['importance_score'] ?? 0) <= 60)->values();

        $missingEssential  = $missingSkillsArr->where('importance_category', 'essential')->values();
        $missingImportant  = $missingSkillsArr->where('importance_category', 'important')->values();
        $missingNiceToHave = $missingSkillsArr->whereNotIn('importance_category', ['essential', 'important'])->values();

        $technicalRequired = $jobSkills->where('type', 'technical')->count();
        $technicalMatched  = $matchedSkillsArr->where('type', 'technical')->count();
        $softRequired      = $jobSkills->where('type', 'soft')->count();
        $softMatched       = $matchedSkillsArr->where('type', 'soft')->count();

        $recommendations = $this->generateRecommendations(
            $matchPercentage,
            $missingSkillsArr,
            $missingEssential,
            $missingImportant
        );

        return [
            'job'                         => $job,
            'match_percentage'            => round($matchPercentage, 2),
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
     * DB-based gap analysis (fallback when Layer 3 API is unavailable).
     * Original logic preserved for resilience.
     *
     * @return array<string, mixed>
     */
    private function performDbBasedGapAnalysis(User $user, Job $job): array
    {
        $userSkills   = $user->skills;
        $userSkillIds = $userSkills->pluck('id');
        $jobSkills    = $job->requiredSkills;

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

        $matchedJobSkills = collect();
        $missingJobSkills = collect();

        foreach ($jobSkills as $jobSkill) {
            $matched = false;
            if ($userSkillIds->contains($jobSkill->id)) {
                $matched = true;
            }
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

        $toSkillArray = function ($skill) {
            $cat = mb_strtolower($skill->pivot->importance_category ?? 'nice_to_have');
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

        $matchedSkillsArr = $matchedJobSkills->map($toSkillArray);
        $missingSkillsArr = $missingJobSkills->map($toSkillArray);

        $getWeight = function ($category) {
            $category = strtolower($category ?? '');
            if (in_array($category, ['essential', 'critical', 'high'])) return 5;
            if (in_array($category, ['important', 'medium'])) return 3;
            return 1;
        };

        $totalWeight     = $jobSkills->sum(fn($s) => $getWeight($s->pivot->importance_category ?? 'nice_to_have'));
        $matchedWeight   = $matchedSkillsArr->sum(fn($s) => $getWeight($s['importance_category'] ?? 'nice_to_have'));
        $matchPercentage = $totalWeight > 0
            ? min(100, ($matchedWeight / $totalWeight) * 100)
            : ($totalRequired > 0 ? ($matchedJobSkills->count() / $totalRequired) * 100 : 0);
        $matchPercentage = round((float) $matchPercentage, 2);

        $missingSkillsArr = collect($missingSkillsArr)->sortByDesc(fn($s) => $getWeight($s['importance_category']))->values();

        $criticalSkills   = $missingSkillsArr->filter(fn($s) => ($s['importance_score'] ?? 0) > 60)->values();
        $niceToHaveSkills = $missingSkillsArr->filter(fn($s) => ($s['importance_score'] ?? 0) <= 60)->values();

        $missingEssential  = collect($missingSkillsArr)->where('importance_category', 'essential')->values();
        $missingImportant  = collect($missingSkillsArr)->where('importance_category', 'important')->values();
        $missingNiceToHave = collect($missingSkillsArr)->whereNotIn('importance_category', ['essential', 'important'])->values();

        $technicalRequired = $jobSkills->where('type', 'technical')->count();
        $technicalMatched  = $matchedSkillsArr->where('type', 'technical')->count();
        $softRequired      = $jobSkills->where('type', 'soft')->count();
        $softMatched       = $matchedSkillsArr->where('type', 'soft')->count();

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
                $profile = $user->profile()->firstOrCreate([], []);
                $profile->update(['headline' => $jobTitle]);
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
                        $type = (string) $skillData['type'];
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

        return Job::with('requiredSkills')->where(function ($query) use ($keyword, $cleanTitle) {
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
            foreach ($job->requiredSkills as $skill) {
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
            'top_20_skills' => $globalMissingSkills->take(20)->values(),
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

    private function correlationHeaders(): array
    {
        return app()->bound('request.id')
            ? [(string) config('observability.request_id_header', 'X-Request-ID') => app('request.id')]
            : [];
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

    /**
     * Analyze skill gap against a specific target role.
     * Uses JobRoleStatistic or aggregates job skills in real-time.
     */
    public function analyzeTargetRole(User $user, \App\Models\TargetJobRole $targetRole): array
    {
        $user->loadMissing('skills');
        $userSkills = $user->skills->pluck('name')->map(fn($s) => mb_strtolower($s))->toArray();

        // 1. Try to fetch from JobRoleStatistic
        $statistic = \App\Models\JobRoleStatistic::where('role_title', 'like', '%' . $targetRole->name . '%')->first();

        // Identify Top 10 required skills
        $requiredSkills = collect();
        if ($statistic && !empty($statistic->top_skills)) {
            // Keep top 10 from JSON array
            $requiredSkills = collect($statistic->top_skills)->take(10);
        } else {
            // 2. Fallback: Aggregate dynamically from Job Skills
            $jobs = Job::with('requiredSkills')
                ->where('title', 'like', '%' . $targetRole->name . '%')
                ->latest()
                ->take(50)
                ->get();
                
            $skillCounts = [];
            foreach ($jobs as $job) {
                foreach ($job->requiredSkills as $skill) {
                    if (!isset($skillCounts[$skill->name])) {
                        $skillCounts[$skill->name] = 0;
                    }
                    $skillCounts[$skill->name]++;
                }
            }
            arsort($skillCounts);
            
            $count = 0;
            foreach ($skillCounts as $name => $freq) {
                $requiredSkills->push(['name' => $name, 'frequency' => $freq]);
                $count++;
                if ($count >= 10) break;
            }
        }

        $matchedSkills = [];
        $missingSkills = [];

        foreach ($requiredSkills as $reqSkill) {
            $skillName = is_array($reqSkill) ? ($reqSkill['name'] ?? null) : $reqSkill;
            if (!$skillName) continue;
            
            if (in_array(mb_strtolower($skillName), $userSkills)) {
                $matchedSkills[] = $skillName;
            } else {
                $missingSkills[] = $skillName;
            }
        }

        $totalRequired = $requiredSkills->count();
        $marketReadinessScore = $totalRequired > 0 ? round((count($matchedSkills) / $totalRequired) * 100, 1) : 0;

        $roadmap = [];
        if (count($missingSkills) > 0) {
            $topMissing = array_slice($missingSkills, 0, 3);
            $roadmap[] = "Focus your learning heavily on these key missing skills: " . implode(', ', $topMissing) . ".";
            $roadmap[] = "Build 1-2 small projects demonstrating your capability using the missing technologies.";
            if (count($missingSkills) > 3) {
                $roadmap[] = "Once fundamentals are covered, explore secondary skills like " . implode(', ', array_slice($missingSkills, 3, 2)) . " to stand out.";
            }
        } else {
            if ($totalRequired === 0) {
                $roadmap[] = "There isn't enough market data collected yet for " . $targetRole->name . ". Try triggering a Deep Scraping job in Market Intelligence.";
            } else {
                $roadmap[] = "You have a very strong resume profile! Consider tailoring your job applications specifically for " . $targetRole->name . " roles.";
            }
        }

        return [
            'target_role'             => $targetRole->name,
            'total_required'          => $totalRequired,
            'market_readiness_score'  => $marketReadinessScore,
            'matched_skills'          => $matchedSkills,
            'missing_skills'          => $missingSkills,
            'roadmap'                 => $roadmap,
        ];
    }
}
