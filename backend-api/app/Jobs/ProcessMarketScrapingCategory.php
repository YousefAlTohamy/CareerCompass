<?php

namespace App\Jobs;

use App\Models\Job;
use App\Models\JobRoleStatistic;
use App\Models\ScrapingJob;
use App\Models\ScrapingSource;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Bus\Batchable;

class ProcessMarketScrapingCategory implements ShouldQueue
{
    use Batchable, Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 600;
    public $tries = 2;
    public $backoff = 5;

    /**
     * The placeholder token embedded in ScrapingSource endpoint URLs.
     */
    private const QUERY_PLACEHOLDER = '{query}';

    public function __construct(
        protected string $category,
        protected int $maxResultsPerCategory = 30,
        protected array $sources = [],
    ) {
    }

    public function handle(): void
    {
        $startedAt = microtime(true);

        Log::info("Scraping category (batched): {$this->category}", [
            'max_per_category' => $this->maxResultsPerCategory,
        ]);

        // ── Resolve {query} placeholders in source endpoints ──────────
        $resolvedSources = $this->resolveSourcesForCategory($this->sources, $this->category);

        if (empty($resolvedSources)) {
            Log::warning("No sources with {query} placeholder available for: {$this->category}");
            return;
        }

        $scrapingJob = ScrapingJob::create([
            'job_title' => $this->category,
            'type' => 'scheduled',
            'status' => 'pending',
        ]);

        $scrapingJob->markAsStarted();

        try {
            $result = $this->scrapeJobsFromAI($this->category, $this->maxResultsPerCategory, $resolvedSources);

            if (!$result || empty($result['jobs'])) {
                $scrapingJob->markAsFailed(
                    errorMessage: 'Failed to fetch data from AI Engine',
                    discoveredCount: 0,
                    failedCount: 0,
                    processingTimeMs: (int) round((microtime(true) - $startedAt) * 1000),
                );
                return;
            }

            $discovered = count($result['jobs']);
            $stored = 0;
            $duplicates = 0;
            $failed = 0;

            foreach ($result['jobs'] as $jobData) {
                try {
                    $storeResult = $this->storeJob($jobData);
                    if ($storeResult['stored']) {
                        $stored++;
                    } else {
                        $duplicates++;
                    }
                } catch (\Throwable $e) {
                    $failed++;
                    Log::warning('Failed to store scraped job', [
                        'category' => $this->category,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            $scrapingJob->markAsCompleted(
                found: $discovered,
                stored: $stored,
                duplicated: $duplicates,
                discoveredCount: $discovered,
                failedCount: $failed,
                processingTimeMs: (int) round((microtime(true) - $startedAt) * 1000),
            );

            $this->calculateSkillImportance($this->category);
            $this->updateRoleStatistics($this->category, $result);

            Log::info("Completed scraping for {$this->category} (batched)", [
                'discovered' => $discovered,
                'stored' => $stored,
                'duplicates' => $duplicates,
                'failed' => $failed,
            ]);

            // Check health for each source used in this job
            if (!empty($this->sources)) {
                foreach ($this->sources as $sourceData) {
                    if (!empty($sourceData['id'])) {
                        try {
                            $sourceModel = ScrapingSource::find($sourceData['id']);
                            if ($sourceModel) {
                                $sourceModel->deactivateIfUnhealthy();
                            }
                        } catch (\Exception $e) {
                            Log::error("Failed to check health for source ID {$sourceData['id']}", ['error' => $e->getMessage()]);
                        }
                    }
                }
            }
        } catch (\Throwable $e) {
            Log::error("Error scraping category {$this->category} (batched)", [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            $scrapingJob->markAsFailed(
                errorMessage: $e->getMessage(),
                discoveredCount: 0,
                failedCount: 0,
                processingTimeMs: (int) round((microtime(true) - $startedAt) * 1000),
            );
        }
    }

    /**
     * Scrape jobs from AI Engine.
     */
    protected function scrapeJobsFromAI(string $query, int $maxResults, array $sources = []): ?array
    {
        try {
            $aiEngineUrl = config('services.ai_engine.url', 'http://127.0.0.1:8001');
            $timeout = config('services.ai_engine.timeout', 120);

            $response = Http::timeout($timeout)
                ->retry(2, 500, function ($exception, $request) {
                    return $exception instanceof \Illuminate\Http\Client\ConnectionException ||
                        ($exception instanceof \Illuminate\Http\Client\RequestException &&
                            $exception->response &&
                            $exception->response->status() >= 500);
                })
                ->post("{$aiEngineUrl}/scrape-jobs", [
                    'query'               => $query,
                    'max_results'         => $maxResults,
                    'use_samples'         => false,
                    'calculate_statistics' => true,
                    'sources'             => $sources,
                ]);

            if ($response->successful()) {
                return $response->json();
            }

            Log::error('AI Engine scraping failed', [
                'query'  => $query,
                'status' => $response->status(),
                'body'   => $response->body(),
            ]);

            return null;
        } catch (\Exception $e) {
            Log::error('Failed to connect to AI Engine', ['error' => $e->getMessage()]);
            return null;
        }
    }

    // -----------------------------------------------------------------
    // {query} placeholder resolution
    // -----------------------------------------------------------------

    /**
     * Resolve the {query} placeholder in every source endpoint URL,
     * replacing it with the URL-encoded category name.
     *
     * Sources that do NOT contain {query} are skipped with a log warning.
     *
     * @param  array   $sources   Raw source payloads from getActiveSources().
     * @param  string  $category  The target job role name.
     * @return array              Sources with resolved endpoint URLs.
     */
    private function resolveSourcesForCategory(array $sources, string $category): array
    {
        $resolved = [];

        foreach ($sources as $source) {
            $endpoint = $source['endpoint'] ?? '';

            if (!str_contains($endpoint, self::QUERY_PLACEHOLDER)) {
                Log::warning('[ProcessMarketScrapingCategory] Source has no {query} placeholder, skipping', [
                    'source' => $source['name'] ?? 'unknown',
                    'endpoint' => $endpoint,
                    'category' => $category,
                ]);
                continue;
            }

            $source['endpoint'] = str_replace(
                self::QUERY_PLACEHOLDER,
                rawurlencode($category),
                $endpoint
            );

            $resolved[] = $source;
        }

        return $resolved;
    }

    /**
     * Store a single job with its skills.
     */
    protected function storeJob(array $jobData): array
    {
        $existingJob = null;

        if (!empty($jobData['url'])) {
            $url = $this->castToString($jobData['url']);
            $existingJob = Job::where('url', $url)->first();
        }

        if (!$existingJob) {
            $title = $this->castToString($jobData['title'] ?? null, 'Unknown Position');
            $company = $this->castToString($jobData['company'] ?? null, 'Unknown Company');

            $existingJob = Job::where('title', $title)
                ->where('company', $company)
                ->first();
        }

        if ($existingJob) {
            return ['stored' => false, 'job' => $existingJob];
        }

        $sourceModel = ScrapingSource::where('name', $this->castToString($jobData['source'] ?? null, ''))->first();

        $job = Job::create([
            'title' => $this->castToString($jobData['title'] ?? null, 'Unknown Position'),
            'company' => $this->castToString($jobData['company'] ?? null, 'Unknown Company'),
            'description' => $this->castToString($jobData['description'] ?? null, 'No description provided'),
            'location' => $this->castToString($jobData['location'] ?? null, 'Unknown'),
            'salary_range' => $this->castToString($jobData['salary_range'] ?? null, null),
            'job_type' => $this->castToString($jobData['job_type'] ?? null, null),
            'experience' => $this->castToString($jobData['experience'] ?? null, null),
            'url' => $this->castToString($jobData['url'] ?? null, null),
            'source' => $this->castToString($jobData['source'] ?? null, 'unknown'),
            'scraping_source_id' => $sourceModel->id ?? null,
        ]);

        if (!empty($jobData['skills']) && is_array($jobData['skills'])) {
            $skillIds = [];

            foreach ($jobData['skills'] as $skillItem) {
                $skillName = is_array($skillItem) ? ($skillItem['name'] ?? '') : $skillItem;
                $skillName = trim($skillName);

                if (!empty($skillName)) {
                    $skill = \App\Models\Skill::firstOrCreate(['name' => $skillName]);
                    $skillIds[] = $skill->id;
                }
            }

            if (!empty($skillIds)) {
                $job->skills()->syncWithoutDetaching($skillIds);
            }
        }

        return ['stored' => true, 'job' => $job];
    }

    protected function calculateSkillImportance(string $jobTitle): void
    {
        try {
            $jobs = Job::where('title', 'like', "%{$jobTitle}%")
                ->with('skills')
                ->get();

            if ($jobs->isEmpty()) {
                return;
            }

            $totalJobs = $jobs->count();
            $skillFrequency = [];

            foreach ($jobs as $job) {
                foreach ($job->skills as $skill) {
                    if (!isset($skillFrequency[$skill->id])) {
                        $skillFrequency[$skill->id] = ['count' => 0, 'skill' => $skill];
                    }
                    $skillFrequency[$skill->id]['count']++;
                }
            }

            foreach ($skillFrequency as $skillId => $data) {
                $count = $data['count'];
                $percentage = ($count / $totalJobs) * 100;

                $category = 'nice_to_have';
                if ($percentage > 70) {
                    $category = 'essential';
                } elseif ($percentage >= 40) {
                    $category = 'important';
                }

                DB::table('job_skills')
                    ->whereIn('job_id', $jobs->pluck('id'))
                    ->where('skill_id', $skillId)
                    ->update([
                        'importance_score' => round($percentage, 2),
                        'importance_category' => $category,
                        'updated_at' => now(),
                    ]);
            }

            Log::info("Updated skill importance for {$jobTitle}", [
                'total_jobs' => $totalJobs,
                'unique_skills' => count($skillFrequency),
            ]);
        } catch (\Exception $e) {
            Log::error("Error calculating skill importance for {$jobTitle}", [
                'error' => $e->getMessage(),
            ]);
        }
    }

    protected function updateRoleStatistics(string $roleTitle, array $scrapingResult): void
    {
        try {
            $statistic = JobRoleStatistic::firstOrNew(['role_title' => $roleTitle]);

            $topSkills = [];
            if (!empty($scrapingResult['statistics']['skills'])) {
                $topSkills = collect($scrapingResult['statistics']['skills'])
                    ->sortByDesc('percentage')
                    ->take(10)
                    ->toArray();
            }

            $statistic->updateStatistics([
                'total_jobs' => $scrapingResult['total_jobs'] ?? 0,
                'top_skills' => $topSkills,
                'average_experience' => $scrapingResult['statistics']['average_experience'] ?? null,
                'common_locations' => $scrapingResult['statistics']['common_locations'] ?? [],
                'salary_range' => $scrapingResult['statistics']['salary_range'] ?? null,
            ]);

            Log::info("Updated role statistics for {$roleTitle}");
        } catch (\Exception $e) {
            Log::error("Error updating role statistics for {$roleTitle}", [
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function castToString($value, $default = null)
    {
        if (is_null($value)) return $default;
        if (is_array($value)) return implode(', ', array_filter($value));
        return (string) $value;
    }
}

