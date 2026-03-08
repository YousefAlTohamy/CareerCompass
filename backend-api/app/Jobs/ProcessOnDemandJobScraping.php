<?php

namespace App\Jobs;

use App\Models\Job;
use App\Models\JobRoleStatistic;
use App\Models\ScrapingJob;
use App\Models\ScrapingSource;
use App\Models\Skill;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ProcessOnDemandJobScraping implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 180; // 3 minutes for on-demand requests
    public $tries = 2;      // Fail fast; sources independently retry inside Python
    public $backoff = 5;    // 5-second backoff before retry

    protected string $jobTitle;
    protected int $scrapingJobId;
    protected int $maxResults;

    /**
     * Create a new job instance.
     */
    public function __construct(string $jobTitle, int $scrapingJobId, int $maxResults = 30)
    {
        $this->jobTitle = $jobTitle;
        $this->scrapingJobId = $scrapingJobId;
        $this->maxResults = $maxResults;

        // High priority queue
        $this->onQueue('high');
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $scrapingJob = ScrapingJob::find($this->scrapingJobId);

        if (!$scrapingJob) {
            Log::error('Scraping job not found', ['id' => $this->scrapingJobId]);
            return;
        }

        try {
            Log::info("Starting on-demand scraping for: {$this->jobTitle}");

            $scrapingJob->markAsStarted();

            // Fetch active scraping sources from the database
            $sources = $this->getActiveSources();

            // Call AI Engine for specific job title
            $result = $this->scrapeJobTitleFromAI($this->jobTitle, $this->maxResults, $sources);

            if (!$result || empty($result['jobs'])) {
                $scrapingJob->markAsFailed('No jobs found or AI Engine error');
                return;
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

            // Mark as completed
            $scrapingJob->markAsCompleted(
                count($result['jobs']),
                $stored,
                $duplicates
            );

            // Calculate skill importance
            $this->calculateSkillImportance($this->jobTitle);

            // Update role statistics
            $this->updateRoleStatistics($this->jobTitle, $result);

            Log::info("Completed on-demand scraping for {$this->jobTitle}", [
                'found' => count($result['jobs']),
                'stored' => $stored,
                'duplicates' => $duplicates,
            ]);
        } catch (\Exception $e) {
            Log::error("Error in on-demand scraping for {$this->jobTitle}", [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            $scrapingJob->markAsFailed($e->getMessage());
        }
    }

    /**
     * Retrieve all active scraping sources and serialize for the AI Engine.
     *
     * @return array<int, array<string, mixed>>
     */
    protected function getActiveSources(): array
    {
        try {
            return ScrapingSource::active()
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
            Log::error('Failed to load active scraping sources (on-demand)', ['error' => $e->getMessage()]);
            return [];
        }
    }

    /**
     * Scrape specific job title from AI Engine.
     */
    protected function scrapeJobTitleFromAI(string $jobTitle, int $maxResults, array $sources = []): ?array
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
                    'query'               => $jobTitle,
                    'max_results'         => $maxResults,
                    'use_samples'         => false,
                    'calculate_statistics' => true,
                    'sources'             => $sources,  // dynamic sources list
                ]);

            if ($response->successful()) {
                return $response->json();
            }

            Log::error('AI Engine on-demand scraping failed', [
                'job_title' => $jobTitle,
                'status'    => $response->status(),
            ]);

            return null;
        } catch (\Exception $e) {
            Log::error('Failed to connect to AI Engine for on-demand scraping', [
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Store a single job with its skills.
     */
    protected function storeJob(array $jobData): array
    {
        // Normalize URL to prevent duplicates from tracking parameters
        $normalizedUrl = null;
        if (!empty($jobData['url'])) {
            $normalizedUrl = $this->normalizeUrl($jobData['url']);
        }

        // Check for duplicates
        $existingJob = null;

        if ($normalizedUrl) {
            $existingJob = Job::where('url', $normalizedUrl)->first();
        }

        if (!$existingJob) {
            $existingJob = Job::where('title', $jobData['title'] ?? 'Unknown Position')
                ->where('company', $jobData['company'] ?? 'Unknown Company')
                ->first();
        }

        if ($existingJob) {
            return ['stored' => false, 'job' => $existingJob];
        }

        // Create new job with race condition protection
        try {
            $job = Job::create([
                'title' => $jobData['title'] ?? 'Unknown Position',
                'company' => $jobData['company'] ?? 'Unknown Company',
                'description' => $jobData['description'] ?? 'No description provided',
                'location' => $jobData['location'] ?? 'Unknown',
                'salary_range' => $jobData['salary_range'] ?? null,
                'job_type' => $jobData['job_type'] ?? null,
                'experience' => $jobData['experience'] ?? null,
                'url' => $normalizedUrl ?? $jobData['url'] ?? null,
                'source' => $jobData['source'] ?? 'unknown',
            ]);
        } catch (\Illuminate\Database\QueryException $e) {
            // Handle duplicate entry error (race condition)
            if ($e->getCode() == 23000 || str_contains($e->getMessage(), 'Duplicate entry')) {
                Log::info('Duplicate job prevented by database constraint in queue job', [
                    'title' => $jobData['title'] ?? 'Unknown Position',
                    'company' => $jobData['company'] ?? 'Unknown Company',
                ]);

                // Fetch existing job
                $existingJob = Job::where('url', $normalizedUrl ?? $jobData['url'] ?? null)
                    ->orWhere(function ($q) use ($jobData) {
                        $q->where('title', $jobData['title'] ?? 'Unknown Position')
                            ->where('company', $jobData['company'] ?? 'Unknown Company');
                    })
                    ->first();

                return ['stored' => false, 'job' => $existingJob];
            }

            // Re-throw if it's a different error
            throw $e;
        }

        // Attach skills
        if (!empty($jobData['skills']) && is_array($jobData['skills'])) {
            $skillNames = collect($jobData['skills'])->pluck('name')->toArray();
            $skills = Skill::whereIn('name', $skillNames)->get();

            if ($skills->isNotEmpty()) {
                $job->skills()->sync($skills->pluck('id'));
            }
        }

        return ['stored' => true, 'job' => $job];
    }

    /**
     * Normalize URL by removing query parameters and fragments.
     * Prevents duplicates from tracking parameters (e.g., utm_source).
     *
     * @param string $url
     * @return string|null
     */
    protected function normalizeUrl(string $url): ?string
    {
        if (empty($url)) {
            return null;
        }

        // Parse URL and rebuild without query string and fragment
        $parsed = parse_url($url);

        if (!$parsed || !isset($parsed['host'])) {
            return $url; // Return as-is if parsing fails
        }

        $normalized = '';

        // Rebuild URL: scheme://host/path
        if (isset($parsed['scheme'])) {
            $normalized .= $parsed['scheme'] . '://';
        }

        if (isset($parsed['host'])) {
            $normalized .= $parsed['host'];
        }

        if (isset($parsed['path'])) {
            $normalized .= $parsed['path'];
        }

        // Ignore query (?...) and fragment (#...)

        return $normalized;
    }

    /**
     * Calculate skill importance for this job title.
     */
    protected function calculateSkillImportance(string $jobTitle): void
    {
        try {
            // Get all jobs matching this title
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

                // Update pivot records
                DB::table('job_skills')
                    ->whereIn('job_id', $jobs->pluck('id'))
                    ->where('skill_id', $skillId)
                    ->update([
                        'importance_score' => round($percentage, 2),
                        'importance_category' => $category,
                        'updated_at' => now(),
                    ]);
            }

            Log::info("Updated skill importance for on-demand job: {$jobTitle}", [
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

            Log::info("Updated role statistics for on-demand job: {$roleTitle}");
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
        Log::error('On-demand scraping job failed permanently', [
            'job_title' => $this->jobTitle,
            'scraping_job_id' => $this->scrapingJobId,
            'error' => $exception?->getMessage(),
        ]);

        // Update scraping job status
        $scrapingJob = ScrapingJob::find($this->scrapingJobId);
        if ($scrapingJob) {
            $scrapingJob->markAsFailed(
                $exception?->getMessage() ?? 'Job failed after maximum retries'
            );
        }
    }
}
