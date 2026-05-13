<?php

namespace App\Jobs;

use App\Models\Job;
use App\Models\JobRoleStatistic;
use App\Models\ScrapingJob;
use App\Services\ScraperClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Bus\Batchable;

class ProcessMarketScrapingCategory implements ShouldQueue
{
    use Batchable, Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 600; // 10 minutes per category processing
    public $tries = 2;
    public $backoff = [5, 15, 45];

    public function __construct(
        protected string $category,
        protected int $maxResultsPerCategory = 30,
        protected array $sources = [],
    ) {
        $this->onQueue('scraping');
    }

    public function handle(ScraperClient $scraperClient): void
    {
        $startedAt = microtime(true);

        Log::info("Scraping category (batched): {$this->category}", [
            'max_per_category' => $this->maxResultsPerCategory,
        ]);

        if (empty($this->sources)) {
            Log::warning("No sources provided for: {$this->category}");
            return;
        }

        $scrapingJob = ScrapingJob::create([
            'job_title' => $this->category,
            'type' => 'scheduled',
            'status' => 'pending',
        ]);

        $scrapingJob->markAsStarted();
        $failedSources = 0;

        try {
            // Count jobs before scraping to measure discovered amount
            $jobsBeforeCount = Job::where('title', 'like', "%{$this->category}%")->count();
            $attemptedSources = 0;

            foreach ($this->sources as $sourceData) {
                if (empty($sourceData['id'])) {
                    continue;
                }

                $attemptedSources++;
                $sourceId = $sourceData['id'];

                // Deduplication check: Respect the Cache system to prevent concurrent overlaps
                $statusKey = "scraping_source_{$sourceId}_status";
                $status = Cache::get($statusKey, ['is_scraping' => false]);

                if ($status['is_scraping']) {
                    Log::info("Skipping source {$sourceId} for {$this->category} (already being scraped).");
                    continue;
                }

                // Lock source via cache
                Cache::put($statusKey, [
                    'is_scraping' => true, 
                    'count' => 0, 
                    'job_id' => $scrapingJob->id
                ], now()->addHours(2));

                try {
                    $scraperClient->scrape(
                        query: $this->category,
                        limit: $this->maxResultsPerCategory,
                        scrapingJobId: $scrapingJob->id,
                        sourceId: $sourceId,
                    );

                    Log::info("Scraper service completed for source {$sourceId}");
                } catch (\Throwable $e) {
                    $failedSources++;
                    Log::error("Scraper service failed for source {$sourceId}", [
                        'category' => $this->category,
                        'error' => $e->getMessage(),
                    ]);
                } finally {
                    $status = Cache::get($statusKey, ['count' => 0]);
                    $status['is_scraping'] = false;
                    Cache::put($statusKey, $status, now()->addHours(2));
                }
            }

            // Wait a moment for async pipelines to flush results to database
            sleep(2);

            // Count jobs after scraping to determine total stored for this category
            $jobsAfterCount = Job::where('title', 'like', "%{$this->category}%")->count();
            $stored = max(0, $jobsAfterCount - $jobsBeforeCount);
            
            // Note: Data is saved via Laravel API by the Scrapy pipeline.
            // Deduplication is handled there, so we approximate discovered = stored.
            $discovered = $stored;
            $duplicates = 0;
            $failed = $failedSources;

            if ($attemptedSources > 0 && $failedSources === $attemptedSources && $stored === 0) {
                throw new \RuntimeException("All scraper sources failed for {$this->category}.");
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
            $this->updateRoleStatistics($this->category);

            Log::info("Completed scraping for {$this->category} (batched)", [
                'stored' => $stored,
            ]);

        } catch (\Throwable $e) {
            Log::error("Error scraping category {$this->category} (batched)", [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            $scrapingJob->markAsFailed(
                errorMessage: $e->getMessage(),
                discoveredCount: 0,
                failedCount: $failedSources,
                processingTimeMs: (int) round((microtime(true) - $startedAt) * 1000),
            );

            throw $e;
        }
    }

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

            Log::info("Updated skill importance for {$jobTitle}");
        } catch (\Exception $e) {
            Log::error("Error calculating skill importance for {$jobTitle}", [
                'error' => $e->getMessage(),
            ]);
        }
    }

    protected function updateRoleStatistics(string $roleTitle): void
    {
        try {
            $statistic = JobRoleStatistic::firstOrNew(['role_title' => $roleTitle]);

            // Simplified statistics generation based on database count
            $jobsCount = Job::where('title', 'like', "%{$roleTitle}%")->count();
            
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

            Log::info("Updated role statistics for {$roleTitle}");
        } catch (\Exception $e) {
            Log::error("Error updating role statistics for {$roleTitle}", [
                'error' => $e->getMessage(),
            ]);
        }
    }
}
