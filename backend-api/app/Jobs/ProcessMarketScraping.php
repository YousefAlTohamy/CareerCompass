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

class ProcessMarketScraping implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 600; // 10 minutes – multiple sources may take longer
    public $tries = 2;      // Fail fast; sources independently retry inside Python
    public $backoff = 5;    // 5-second backoff before retry

    protected ?array $jobCategories;
    protected int $maxResultsPerCategory;

    /**
     * Create a new job instance.
     */
    public function __construct(?array $jobCategories = null, int $maxResultsPerCategory = 30)
    {
        $this->jobCategories = $jobCategories;
        $this->maxResultsPerCategory = $maxResultsPerCategory;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $categoriesToProcess = $this->jobCategories ?? \App\Models\TargetJobRole::where('is_active', true)->pluck('name')->toArray();

        if (empty($categoriesToProcess)) {
            Log::info('No active job categories to scrape');
            return;
        }

        Log::info('Starting automated market scraping', [
            'categories' => $categoriesToProcess,
            'max_per_category' => $this->maxResultsPerCategory,
        ]);

        $totalStored = 0;
        $totalDuplicates = 0;

        // Process each category sequentially to prevent overwhelming the system
        foreach ($categoriesToProcess as $category) {
            try {
                Log::info("Scraping category: {$category}");

                // Create tracking record
                $scrapingJob = ScrapingJob::create([
                    'job_title' => $category,
                    'type' => 'scheduled',
                    'status' => 'pending',
                ]);

                $scrapingJob->markAsStarted();

                // Fetch active scraping sources from the database
                $sources = $this->getActiveSources();

                // Call AI Engine, passing the dynamic sources list
                $result = $this->scrapeJobsFromAI($category, $this->maxResultsPerCategory, $sources);

                if (!$result) {
                    $scrapingJob->markAsFailed('Failed to fetch data from AI Engine');
                    continue;
                }

                // Store jobs
                $stored = 0;
                $duplicates = 0;

                foreach ($result['jobs'] as $jobData) {
                    $storeResult = $this->storeJob($jobData);
                    if ($storeResult['stored']) {
                        $stored++;
                    } else {
                        $duplicates++;
                    }
                }

                // Update tracking
                $scrapingJob->markAsCompleted(
                    count($result['jobs']),
                    $stored,
                    $duplicates
                );

                // Calculate skill importance for this category
                $this->calculateSkillImportance($category);

                // Update role statistics
                $this->updateRoleStatistics($category, $result);

                $totalStored += $stored;
                $totalDuplicates += $duplicates;

                Log::info("Completed scraping for {$category}", [
                    'stored' => $stored,
                    'duplicates' => $duplicates,
                ]);

                // Delay between categories to be respectful
                sleep(3);
            } catch (\Exception $e) {
                Log::error("Error scraping category {$category}", [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);

                if (isset($scrapingJob)) {
                    $scrapingJob->markAsFailed($e->getMessage());
                }
            }
        }

        Log::info('Automated market scraping completed', [
            'total_stored' => $totalStored,
            'total_duplicates' => $totalDuplicates,
        ]);
    }

    /**
     * Retrieve all active scraping sources and serialize for the AI Engine.
     *
     * @return array<int, array<string, mixed>>
     */
    protected function getActiveSources(): array
    {
        try {
            return ScrapingSource::where('status', 'active')
                ->get(['id', 'name', 'endpoint', 'type', 'headers', 'params'])
                ->map(fn($s) => [
                    'id'       => $s->id,
                    'name'     => $s->name,
                    'endpoint' => $s->endpoint,
                    'type'     => $s->type,
                    'headers'  => $s->headers ?? [],
                    'params'   => $s->params  ?? [],
                ])
                ->toArray();
        } catch (\Exception $e) {
            Log::error('Failed to load active scraping sources', ['error' => $e->getMessage()]);
            return [];
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
                    'sources'             => $sources,  // dynamic sources list
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

    /**
     * Store a single job with its skills.
     */
    protected function storeJob(array $jobData): array
    {
        // Check for duplicates
        $existingJob = null;

        if (!empty($jobData['url'])) {
            $existingJob = Job::where('url', $jobData['url'])->first();
        }

        if (!$existingJob) {
            $existingJob = Job::where('title', $jobData['title'] ?? 'Unknown Position')
                ->where('company', $jobData['company'] ?? 'Unknown Company')
                ->first();
        }

        if ($existingJob) {
            return ['stored' => false, 'job' => $existingJob];
        }

        $sourceModel = \App\Models\ScrapingSource::where('name', $jobData['source'] ?? '')->first();

        // Create new job
        $job = Job::create([
            'title' => $jobData['title'] ?? 'Unknown Position',
            'company' => $jobData['company'] ?? 'Unknown Company',
            'description' => $jobData['description'] ?? 'No description provided',
            'location' => $jobData['location'] ?? 'Unknown',
            'salary_range' => $jobData['salary_range'] ?? null,
            'job_type' => $jobData['job_type'] ?? null,
            'experience' => $jobData['experience'] ?? null,
            'url' => $jobData['url'] ?? null,
            'source' => $jobData['source'] ?? 'unknown',
            'scraping_source_id' => $sourceModel->id ?? null,
        ]);

        // Attach skills
        if (!empty($jobData['skills']) && is_array($jobData['skills'])) {
            $skillIds = [];

            foreach ($jobData['skills'] as $skillItem) {
                // Handle both string and array formats from Python
                $skillName = is_array($skillItem) ? ($skillItem['name'] ?? '') : $skillItem;
                $skillName = trim($skillName);

                if (!empty($skillName)) {
                    // Create the skill if it doesn't exist, or get it if it does
                    $skill = \App\Models\Skill::firstOrCreate(['name' => $skillName]);
                    $skillIds[] = $skill->id;
                }
            }

            // Sync the skills to the job
            if (!empty($skillIds)) {
                $job->skills()->syncWithoutDetaching($skillIds);
            }
        }

        return ['stored' => true, 'job' => $job];
    }

    /**
     * Calculate skill importance for a job category.
     */
    protected function calculateSkillImportance(string $jobTitle): void
    {
        try {
            // Get all jobs for this title
            $jobs = Job::where('title', 'like', "%{$jobTitle}%")
                ->with('skills')
                ->get();

            if ($jobs->isEmpty()) {
                return;
            }

            $totalJobs = $jobs->count();
            $skillFrequency = [];

            // Count skill occurrences
            foreach ($jobs as $job) {
                foreach ($job->skills as $skill) {
                    if (!isset($skillFrequency[$skill->id])) {
                        $skillFrequency[$skill->id] = ['count' => 0, 'skill' => $skill];
                    }
                    $skillFrequency[$skill->id]['count']++;
                }
            }

            // Update importance scores
            foreach ($skillFrequency as $skillId => $data) {
                $count = $data['count'];
                $percentage = ($count / $totalJobs) * 100;

                // Determine category
                $category = 'nice_to_have';
                if ($percentage > 70) {
                    $category = 'essential';
                } elseif ($percentage >= 40) {
                    $category = 'important';
                }

                // Update all job-skill pivot records for this role and skill
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

    /**
     * Update role statistics.
     */
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

    /**
     * Handle a job failure.
     */
    public function failed(?\Throwable $exception): void
    {
        Log::error('Market scraping job failed permanently', [
            'categories' => $this->jobCategories ?? \App\Models\TargetJobRole::where('is_active', true)->pluck('name')->toArray(),
            'error' => $exception?->getMessage(),
            'trace' => $exception?->getTraceAsString(),
        ]);

        $categoriesToUpdate = $this->jobCategories ?? \App\Models\TargetJobRole::where('is_active', true)->pluck('name')->toArray();

        // Mark any pending scraping jobs as failed
        ScrapingJob::where('type', 'scheduled')
            ->where('status', 'processing')
            ->whereIn('job_title', $categoriesToUpdate)
            ->update([
                'status' => 'failed',
                'error_message' => $exception?->getMessage() ?? 'Job failed after maximum retries',
                'updated_at' => now(),
            ]);
    }
}
