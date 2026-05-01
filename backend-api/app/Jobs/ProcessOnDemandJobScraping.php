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
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

class ProcessOnDemandJobScraping implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 600; // 10 minutes for Scrapy execution
    public $tries = 2;
    public $backoff = 5;

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
        $startedAt = microtime(true);
        $scrapingJob = ScrapingJob::find($this->scrapingJobId);

        if (!$scrapingJob) {
            Log::error('Scraping job not found', ['id' => $this->scrapingJobId]);
            return;
        }

        try {
            Log::info("Starting on-demand scraping via Scrapy for: {$this->jobTitle}");

            $scrapingJob->markAsStarted();

            // Count jobs before scraping to measure discovered
            $jobsBeforeCount = Job::where('title', 'like', "%{$this->jobTitle}%")->count();

            // Setup Scrapy command execution
            $scrapyPath = base_path('../ai-job-miner');
            
            // Build the Scrapy command
            // Note: We use escapeshellarg for safety, though Process handles argument escaping internally when using arrays
            $command = [
                'scrapy', 'crawl', 'linkedin', 
                '-a', 'query=' . $this->jobTitle,
                '-a', 'limit=' . $this->maxResults
            ];

            Log::info("Executing Scrapy", ['command' => implode(' ', $command)]);

            $process = Process::path($scrapyPath)
                ->env([
                    'LARAVEL_API_TOKEN' => config('services.scrapy.token', 'YOUR_SANCTUM_TOKEN'),
                    'LARAVEL_API_URL' => url('/api/jobs/import'),
                    'LARAVEL_API_CHECK_URL' => url('/api/jobs/import/check'),
                    'LARAVEL_API_FAILED_URL' => url('/api/jobs/import/failed'),
                    'LARAVEL_API_PROXIES_URL' => url('/api/proxies/active'),
                ])
                ->timeout($this->timeout)
                ->run($command);

            if ($process->failed()) {
                Log::error('Scrapy execution failed', [
                    'error' => $process->errorOutput(),
                    'output' => $process->output(),
                ]);
                throw new \Exception("Scrapy process failed: " . $process->errorOutput());
            }

            Log::info('Scrapy process completed', ['output' => $process->output()]);

            // Wait a moment for async pipelines to flush to database
            sleep(2);

            // Count jobs after scraping
            $jobsAfterCount = Job::where('title', 'like', "%{$this->jobTitle}%")->count();
            $stored = max(0, $jobsAfterCount - $jobsBeforeCount);
            
            // Since deduplication pipeline handles duplicates, we can estimate duplicates if needed,
            // but for simplicity, we just mark what was stored.
            $discovered = $stored; // Approximate
            $duplicates = 0;
            $failed = 0;

            // Mark as completed
            $scrapingJob->markAsCompleted(
                found: $discovered,
                stored: $stored,
                duplicated: $duplicates,
                discoveredCount: $discovered,
                failedCount: $failed,
                processingTimeMs: (int) round((microtime(true) - $startedAt) * 1000),
            );

            // Calculate skill importance
            $this->calculateSkillImportance($this->jobTitle);

            // Update role statistics
            $this->updateRoleStatistics($this->jobTitle);

            Log::info("Completed on-demand scraping for {$this->jobTitle}", [
                'stored' => $stored,
                'duplicates' => $duplicates,
            ]);
        } catch (\Exception $e) {
            Log::error("Error in on-demand scraping for {$this->jobTitle}", [
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
    protected function updateRoleStatistics(string $roleTitle): void
    {
        try {
            $statistic = JobRoleStatistic::firstOrNew(['role_title' => $roleTitle]);

            // Simplified statistics generation
            $jobsCount = Job::where('title', 'like', "%{$roleTitle}%")->count();
            
            // Get top skills
            $topSkills = DB::table('job_skills')
                ->join('jobs', 'job_skills.job_id', '=', 'jobs.id')
                ->join('skills', 'job_skills.skill_id', '=', 'skills.id')
                ->where('jobs.title', 'like', "%{$roleTitle}%")
                ->select('skills.name', DB::raw('COUNT(skills.id) as count'))
                ->groupBy('skills.id', 'skills.name')
                ->orderByDesc('count')
                ->limit(10)
                ->get()
                ->map(function ($skill) use ($jobsCount) {
                    return [
                        'name' => $skill->name,
                        'percentage' => $jobsCount > 0 ? round(($skill->count / $jobsCount) * 100, 2) : 0
                    ];
                })
                ->toArray();

            $statistic->updateStatistics([
                'total_jobs' => $jobsCount,
                'top_skills' => $topSkills,
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
