<?php

namespace App\Jobs;

use App\Models\Job;
use App\Models\JobRoleStatistic;
use App\Models\ScrapingFailedUrl;
use App\Models\ScrapingJob;
use App\Services\ScraperClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ProcessOnDemandJobScraping implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 600; // 10 minutes for Scrapy execution
    public $tries = 2;
    public $backoff = [5, 15, 45];

    protected string $jobTitle;
    protected int $scrapingJobId;
    protected int $maxResults;
    protected ?int $sourceId;

    /**
     * Create a new job instance.
     */
    public function __construct(string $jobTitle, int $scrapingJobId, int $maxResults = 30, ?int $sourceId = null)
    {
        $this->jobTitle = $jobTitle;
        $this->scrapingJobId = $scrapingJobId;
        $this->maxResults = $maxResults;
        $this->sourceId = $sourceId;

        $this->onQueue('scraping');
    }

    /**
     * Execute the job.
     */
    public function handle(ScraperClient $scraperClient): void
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

            if ($this->sourceId) {
                Cache::put("scraping_source_{$this->sourceId}_status", [
                    'is_scraping' => true, 
                    'count' => 0, 
                    'job_id' => $this->scrapingJobId
                ], now()->addHours(2));
            }

            $scrapeResult = $scraperClient->scrape(
                query: $this->jobTitle,
                limit: $this->maxResults,
                scrapingJobId: $this->scrapingJobId,
                sourceId: $this->sourceId,
            );

            // Wait a moment for async pipelines to flush to database
            sleep(2);

            // Count jobs after scraping
            $jobsAfterCount = Job::where('title', 'like', "%{$this->jobTitle}%")->count();
            $stored = max(0, $jobsAfterCount - $jobsBeforeCount);
            
            // Since deduplication pipeline handles duplicates, we can estimate duplicates if needed,
            // but for simplicity, we just mark what was stored.
            $discovered = $stored; // Approximate
            $duplicates = 0;
            $failed = ScrapingFailedUrl::where('scraping_job_id', $this->scrapingJobId)->count();

            if ($stored === 0 && $failed > 0) {
                $scrapingJob->markAsFailed(
                    errorMessage: 'Scraper completed without storing jobs and reported failed URLs. External source may be blocked or unavailable.',
                    discoveredCount: 0,
                    failedCount: $failed,
                    processingTimeMs: (int) round((microtime(true) - $startedAt) * 1000),
                );

                Log::warning("On-demand scraping finished with only failed URLs for {$this->jobTitle}", [
                    'failed_count' => $failed,
                    'scraper_elapsed_ms' => $scrapeResult['elapsed_ms'] ?? null,
                ]);

                if ($this->sourceId) {
                    $status = Cache::get("scraping_source_{$this->sourceId}_status", ['count' => 0]);
                    $status['is_scraping'] = false;
                    Cache::put("scraping_source_{$this->sourceId}_status", $status, now()->addHours(2));
                }

                return;
            }

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
                'scraper_elapsed_ms' => $scrapeResult['elapsed_ms'] ?? null,
            ]);

            if ($this->sourceId) {
                $status = Cache::get("scraping_source_{$this->sourceId}_status", ['count' => 0]);
                $status['is_scraping'] = false;
                Cache::put("scraping_source_{$this->sourceId}_status", $status, now()->addHours(2));
            }
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

            if ($this->sourceId) {
                $status = Cache::get("scraping_source_{$this->sourceId}_status", ['count' => 0]);
                $status['is_scraping'] = false;
                Cache::put("scraping_source_{$this->sourceId}_status", $status, now()->addHours(2));
            }

            throw $e;
        }
    }

    /**
     * Calculate skill importance for this job title.
     */
    protected function calculateSkillImportance(string $jobTitle): void
    {
        try {
            $totalJobs = Job::where('title', 'like', "%{$jobTitle}%")->count();

            if ($totalJobs === 0) {
                return;
            }

            $skillStats = DB::table('job_skills')
                ->join('job_postings', 'job_skills.job_id', '=', 'job_postings.id')
                ->where('job_postings.title', 'like', "%{$jobTitle}%")
                ->select(
                    'job_skills.skill_id',
                    DB::raw('COUNT(DISTINCT job_skills.job_id) as job_count')
                )
                ->groupBy('job_skills.skill_id')
                ->get();

            foreach ($skillStats as $stat) {
                $percentage = ($stat->job_count / $totalJobs) * 100;

                $category = 'nice_to_have';
                if ($percentage > 70) {
                    $category = 'essential';
                } elseif ($percentage >= 40) {
                    $category = 'important';
                }

                DB::table('job_skills')
                    ->join('job_postings', 'job_skills.job_id', '=', 'job_postings.id')
                    ->where('job_postings.title', 'like', "%{$jobTitle}%")
                    ->where('job_skills.skill_id', $stat->skill_id)
                    ->update([
                        'job_skills.importance_score' => round($percentage, 2),
                        'job_skills.importance_category' => $category,
                        'job_skills.updated_at' => now(),
                    ]);
            }

            Log::info("Updated skill importance for on-demand job: {$jobTitle}");
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
                ->join('job_postings', 'job_skills.job_id', '=', 'job_postings.id')
                ->join('skills', 'job_skills.skill_id', '=', 'skills.id')
                ->where('job_postings.title', 'like', "%{$roleTitle}%")
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
