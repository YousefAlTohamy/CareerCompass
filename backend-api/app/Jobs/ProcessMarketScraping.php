<?php

namespace App\Jobs;

use App\Models\ScrapingJob;
use App\Models\ScrapingSource;
use Illuminate\Bus\Batch;
use Illuminate\Bus\Batchable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Artisan;
use Throwable;

class ProcessMarketScraping implements ShouldQueue
{
    use Batchable, Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 600; // 10 minutes – multiple sources may take longer
    public $tries = 2;      // Fail fast; sources independently retry inside Python
    public $backoff = [5, 15, 45];

    protected ?array $jobCategories;
    protected int $maxResultsPerCategory;

    /**
     * Create a new job instance.
     */
    public function __construct(?array $jobCategories = null, int $maxResultsPerCategory = 30)
    {
        $this->jobCategories = $jobCategories;
        $this->maxResultsPerCategory = $maxResultsPerCategory;
        $this->onQueue('scraping');
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        if ($this->batch()?->cancelled()) {
            Log::info('Market scraping batch cancelled before start');
            return;
        }

        $categoriesToProcess = $this->jobCategories ?? \App\Models\TargetJobRole::where('is_active', true)->pluck('name')->toArray();

        if (empty($categoriesToProcess)) {
            Log::info('No active job categories to scrape');
            return;
        }

        Log::info('Starting automated market scraping', [
            'categories' => $categoriesToProcess,
            'max_per_category' => $this->maxResultsPerCategory,
        ]);

        $sources = $this->getActiveSources();

        $jobs = collect($categoriesToProcess)
            ->map(fn (string $category) => new ProcessMarketScrapingCategory(
                category: $category,
                maxResultsPerCategory: $this->maxResultsPerCategory,
                sources: $sources,
            ))
            ->all();

        Bus::batch($jobs)
            ->name('market-scraping:' . now()->toDateTimeString())
            ->onQueue('scraping')
            ->then(function (Batch $batch) use ($categoriesToProcess) {
                Log::info('Market scraping batch completed', [
                    'batch_id' => $batch->id,
                    'categories' => $categoriesToProcess,
                    'total_jobs' => $batch->totalJobs,
                    'failed_jobs' => $batch->failedJobs,
                ]);
            })
            ->catch(function (Batch $batch, Throwable $e) {
                Log::error('Market scraping batch encountered an error', [
                    'batch_id' => $batch->id,
                    'error' => $e->getMessage(),
                ]);
            })
            ->finally(function (Batch $batch) {
                Log::info('Market scraping batch finished (finally)', [
                    'batch_id' => $batch->id,
                    'cancelled' => $batch->cancelled(),
                    'processed_jobs' => $batch->processedJobs(),
                    'failed_jobs' => $batch->failedJobs,
                ]);

                try {
                    Artisan::call('app:export-skills');
                    Log::info('Successfully exported skills to JSON after market scraping batch');
                } catch (\Exception $e) {
                    Log::error('Failed to export skills to JSON', ['error' => $e->getMessage()]);
                }
            })
            ->dispatch();
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
                ->get(['id', 'name', 'endpoint', 'method', 'type', 'headers', 'params', 'mode', 'pattern'])
                ->map(function ($s) {
                    $support = $s->supportMetadata();

                    return [
                        'id'       => $s->id,
                        'name'     => $s->name,
                        'endpoint' => $s->endpoint,
                        'method'   => $s->method ?? 'GET',
                        'type'     => $s->type,
                        'headers'  => $s->headers ?? [],
                        'params'   => $s->params  ?? [],
                        'mode'     => $s->mode ?? 'static',
                        'pattern'  => $s->pattern,
                        'adapter_name' => $support['adapter_name'] ?? $s->adapterName(),
                        'adapter_mode' => $support['adapter_mode'] ?? 'adapter_missing',
                        'support_status' => $support['support_status'] ?? 'unknown',
                        'requires_credentials' => (bool) ($support['requires_credentials'] ?? false),
                        'requires_proxy' => (bool) ($support['requires_proxy'] ?? false),
                        'is_runnable' => (bool) ($support['is_runnable'] ?? false),
                    ];
                })
                ->filter(fn (array $source): bool => (bool) ($source['is_runnable'] ?? false))
                ->values()
                ->toArray();
        } catch (\Exception $e) {
            Log::error('Failed to load active scraping sources', ['error' => $e->getMessage()]);
            return [];
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
