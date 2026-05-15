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
        protected string $runType = 'scheduled',
    ) {
        $this->onQueue('scraping');
    }

    public function handle(ScraperClient $scraperClient): void
    {
        Log::info("Scraping category (batched): {$this->category}", [
            'max_per_category' => $this->maxResultsPerCategory,
            'run_type' => $this->runType,
            'sources' => collect($this->sources)->pluck('id')->values()->all(),
        ]);

        if (empty($this->sources)) {
            Log::warning("No sources provided for: {$this->category}");
            return;
        }

        foreach ($this->sources as $sourceData) {
            if (empty($sourceData['id'])) {
                continue;
            }

            $this->scrapeSourceTarget($scraperClient, $sourceData);
        }
    }

    protected function scrapeSourceTarget(ScraperClient $scraperClient, array $sourceData): void
    {
        $startedAt = microtime(true);
        $sourceId = (int) $sourceData['id'];
        $sourceName = (string) ($sourceData['name'] ?? "Source {$sourceId}");
        $statusKey = "scraping_source_{$sourceId}_status";
        $status = Cache::get($statusKey, ['is_scraping' => false]);

        if ((bool) ($status['is_scraping'] ?? false)) {
            Log::info("Skipping source {$sourceId} for {$this->category} (already being scraped).");
            return;
        }

        $scrapingJob = ScrapingJob::create([
            'job_title' => $this->category,
            'type' => $this->runType === 'manual' ? 'on_demand' : 'scheduled',
            'status' => 'pending',
        ]);

        $this->putSourceStatus($sourceId, [
            'source_name' => $sourceName,
            'is_scraping' => true,
            'status' => 'queued',
            'progress_percent' => 5,
            'target' => $this->category,
            'query' => $this->category,
            'scraping_job_id' => $scrapingJob->id,
            'jobs_found' => 0,
            'jobs_stored' => 0,
            'failed_count' => 0,
            'count' => 0,
            'elapsed_seconds' => 0,
            'message' => "Queued {$sourceName} for {$this->category}",
            'last_error' => null,
        ]);

        try {
            $scrapingJob->markAsStarted();
            $jobsBeforeCount = Job::where('title', 'like', "%{$this->category}%")->count();

            $this->putSourceStatus($sourceId, [
                'status' => 'running',
                'progress_percent' => 40,
                'message' => "Running {$sourceName} for {$this->category}",
            ]);

            $scrapeResult = $scraperClient->scrape(
                query: $this->category,
                limit: $this->maxResultsPerCategory,
                scrapingJobId: $scrapingJob->id,
                sourceId: $sourceId,
                allowFailure: true,
            );

            $this->putSourceStatus($sourceId, [
                'status' => 'importing',
                'progress_percent' => 75,
                'jobs_found' => (int) ($scrapeResult['jobs_preview_count'] ?? 0),
                'jobs_stored' => (int) ($scrapeResult['jobs_stored'] ?? 0),
                'failed_count' => (int) ($scrapeResult['failed_urls_count'] ?? 0),
                'message' => "Importing {$sourceName} results for {$this->category}",
                'last_error' => $scrapeResult['error_summary'] ?? null,
            ]);

            sleep(1);

            $jobsAfterCount = Job::where('title', 'like', "%{$this->category}%")->count();
            $stored = max((int) ($scrapeResult['jobs_stored'] ?? 0), max(0, $jobsAfterCount - $jobsBeforeCount));
            $found = max((int) ($scrapeResult['jobs_preview_count'] ?? 0), $stored);
            $failed = max(
                (int) ($scrapeResult['failed_urls_count'] ?? 0),
                $scrapingJob->failedUrls()->count(),
            );
            $classification = (string) ($scrapeResult['classification'] ?? $this->classificationFromCounts($stored, $failed, (bool) ($scrapeResult['success'] ?? false)));
            $elapsedMs = (int) round((microtime(true) - $startedAt) * 1000);

            if ($this->classificationIsAcceptable($classification)) {
                $scrapingJob->markAsCompleted(
                    found: $found,
                    stored: $stored,
                    duplicated: 0,
                    discoveredCount: $found,
                    failedCount: $failed,
                    processingTimeMs: $elapsedMs,
                );

                if ($stored > 0) {
                    $this->calculateSkillImportance($this->category);
                    $this->updateRoleStatistics($this->category);
                }

                $this->putSourceStatus($sourceId, [
                    'is_scraping' => false,
                    'status' => $this->statusForClassification($classification),
                    'progress_percent' => 100,
                    'jobs_found' => $found,
                    'jobs_stored' => $stored,
                    'failed_count' => $failed,
                    'count' => $stored,
                    'elapsed_seconds' => (int) round($elapsedMs / 1000),
                    'message' => $this->messageForClassification($classification, $sourceName, $stored, $failed),
                    'last_error' => $scrapeResult['error_summary'] ?? null,
                ]);

                Log::info("Completed scraping source-target run", [
                    'category' => $this->category,
                    'source_id' => $sourceId,
                    'classification' => $classification,
                    'stored' => $stored,
                    'failed' => $failed,
                ]);

                return;
            }

            $error = $scrapeResult['error_summary']
                ?? "Source {$sourceName} returned {$classification} and stored no usable jobs.";

            $scrapingJob->markAsFailed(
                errorMessage: $error,
                discoveredCount: $found,
                failedCount: $failed,
                processingTimeMs: $elapsedMs,
            );

            $this->putSourceStatus($sourceId, [
                'is_scraping' => false,
                'status' => $this->statusForClassification($classification),
                'progress_percent' => 100,
                'jobs_found' => $found,
                'jobs_stored' => $stored,
                'failed_count' => $failed,
                'count' => $stored,
                'elapsed_seconds' => (int) round($elapsedMs / 1000),
                'message' => $this->messageForClassification($classification, $sourceName, $stored, $failed),
                'last_error' => $error,
            ]);

            Log::warning("Scraping source-target run finished without usable imports", [
                'category' => $this->category,
                'source_id' => $sourceId,
                'classification' => $classification,
                'error' => $error,
            ]);
        } catch (\Throwable $e) {
            $elapsedMs = (int) round((microtime(true) - $startedAt) * 1000);

            Log::error("Error scraping {$this->category} with source {$sourceId}", [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            $scrapingJob->markAsFailed(
                errorMessage: $e->getMessage(),
                discoveredCount: 0,
                failedCount: 1,
                processingTimeMs: $elapsedMs,
            );

            $this->putSourceStatus($sourceId, [
                'is_scraping' => false,
                'status' => 'failed',
                'progress_percent' => 100,
                'jobs_found' => 0,
                'jobs_stored' => 0,
                'failed_count' => 1,
                'elapsed_seconds' => (int) round($elapsedMs / 1000),
                'message' => "{$sourceName} failed for {$this->category}",
                'last_error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    protected function putSourceStatus(int $sourceId, array $payload): void
    {
        $existing = Cache::get("scraping_source_{$sourceId}_status", []);

        Cache::put("scraping_source_{$sourceId}_status", array_merge([
            'source_id' => $sourceId,
            'is_scraping' => false,
            'status' => 'idle',
            'progress_percent' => 0,
            'target' => null,
            'query' => null,
            'scraping_job_id' => null,
            'jobs_found' => 0,
            'jobs_stored' => 0,
            'failed_count' => 0,
            'count' => 0,
            'elapsed_seconds' => 0,
            'message' => 'Idle',
            'last_error' => null,
        ], $existing, $payload, [
            'last_updated_at' => now()->toIso8601String(),
        ]), now()->addHours(2));
    }

    protected function classificationFromCounts(int $stored, int $failed, bool $success): string
    {
        if ($stored > 0 && $failed > 0) {
            return 'PARTIAL_SUCCESS';
        }

        if ($stored > 0) {
            return 'SUCCESS';
        }

        if ($success && $failed === 0) {
            return 'EMPTY_SUCCESS';
        }

        return $failed > 0 ? 'EXTERNAL_FAILED' : 'ADAPTER_MISSING';
    }

    protected function classificationIsAcceptable(string $classification): bool
    {
        return in_array($classification, ['SUCCESS', 'PARTIAL_SUCCESS', 'EMPTY_SUCCESS'], true);
    }

    protected function statusForClassification(string $classification): string
    {
        return match ($classification) {
            'SUCCESS', 'EMPTY_SUCCESS' => 'completed',
            'PARTIAL_SUCCESS' => 'compromised',
            'UNSUPPORTED', 'ADAPTER_MISSING' => 'adapter_missing',
            'CONFIG_REQUIRED' => 'config_required',
            'CONFIG_INVALID' => 'config_invalid',
            'EXTERNAL_BLOCKED' => 'external_blocked',
            'INTEGRITY_COMPROMISED' => 'compromised',
            default => 'failed',
        };
    }

    protected function messageForClassification(string $classification, string $sourceName, int $stored, int $failed): string
    {
        return match ($classification) {
            'SUCCESS' => "{$sourceName} completed and stored {$stored} jobs.",
            'PARTIAL_SUCCESS' => "{$sourceName} stored {$stored} jobs with {$failed} failed URLs.",
            'EMPTY_SUCCESS' => "{$sourceName} responded normally but found no jobs.",
            'UNSUPPORTED', 'ADAPTER_MISSING' => "{$sourceName} needs a source-specific scraper adapter before it can run.",
            'CONFIG_REQUIRED' => "{$sourceName} requires credentials before it can run.",
            'CONFIG_INVALID' => "{$sourceName} configuration is invalid.",
            'EXTERNAL_BLOCKED' => "{$sourceName} was blocked by the external site; no jobs were imported.",
            'INTEGRITY_COMPROMISED' => "{$sourceName} finished with runtime or DLQ errors.",
            default => "{$sourceName} failed; no jobs were imported.",
        };
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
