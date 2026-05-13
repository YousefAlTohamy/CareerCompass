<?php

namespace App\Console\Commands;

use App\Models\Job;
use App\Models\ScrapingJob;
use App\Models\ScrapingSource;
use App\Models\TargetJobRole;
use App\Services\ScraperClient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ScrapeJobs extends Command
{
    protected $signature = 'jobs:scrape
                            {--count=20 : Number of jobs to fetch per source/role pair}
                            {--queue : Run scraping in background queue}
                            {--categories=* : Specific job categories to scrape}';
    protected $description = 'Scrape jobs from all active sources × target roles and store in database';

    // -----------------------------------------------------------------
    // The placeholder token embedded in ScrapingSource endpoint URLs.
    // -----------------------------------------------------------------
    private const QUERY_PLACEHOLDER = '{query}';

    public function handle(ScraperClient $scraperClient): int
    {
        $count = $this->option('count');
        $useQueue = $this->option('queue');
        $categories = $this->option('categories');

        // If no categories specified, do not default to ['developer'].
        // For queue, ProcessMarketScraping will handle dynamic active roles.
        if (empty($categories)) {
            $categories = null;
        }

        if ($useQueue) {
            // Dispatch to queue for background processing
            $this->info('Dispatching scraping job to queue...');

            \App\Jobs\ProcessMarketScraping::dispatch($categories, (int) $count);

            $this->info('✓ Scraping job dispatched to queue!');
            $this->info('Monitor with: php artisan queue:work');
            return 0;
        }

        // ── Synchronous mode: Source × Role nested loop ──────────────
        $roles = $this->resolveRoles($categories);

        if (empty($roles)) {
            $this->warn('No active target roles found. Add roles on the Target Roles page.');
            return 1;
        }

        $sources = ScrapingSource::where('status', 'active')
            ->get(['id', 'name', 'endpoint', 'type', 'headers', 'params']);

        if ($sources->isEmpty()) {
            $this->warn('No active scraping sources configured.');
            return 1;
        }

        $this->info("Starting global scrape: {$sources->count()} source(s) × " . count($roles) . " role(s)");
        $this->newLine();

        $totalStored = 0;
        $totalRejected = 0;
        $totalSkipped = 0;

        foreach ($sources as $source) {
            foreach ($roles as $role) {
                // ── Resolve {query} placeholder in endpoint URL ───────
                $resolvedEndpoint = $this->resolveQueryPlaceholder($source->endpoint, $role);

                if ($resolvedEndpoint === null) {
                    $totalSkipped++;
                    $this->warn("SKIP: Source \"{$source->name}\" has no {query} placeholder — skipping for \"{$role}\"");
                    Log::warning('[ScrapeJobs] Source skipped (no {query} placeholder)', [
                        'source' => $source->name,
                        'role'   => $role,
                        'url'    => $source->endpoint,
                    ]);
                    continue;
                }

                $this->info("▶ [{$source->name}] × [{$role}]");
                $this->line("  URL: {$resolvedEndpoint}");

                try {
                    $before = Job::where('title', 'like', "%{$role}%")->count();
                    $scrapingJob = ScrapingJob::create([
                        'job_title' => $role,
                        'type' => 'on_demand',
                        'status' => 'processing',
                        'started_at' => now(),
                    ]);

                    $result = $scraperClient->scrape(
                        query: $role,
                        limit: (int) $count,
                        scrapingJobId: $scrapingJob->id,
                        sourceId: $source->id,
                    );

                    sleep(2);
                    $after = Job::where('title', 'like', "%{$role}%")->count();
                    $stored = max(0, $after - $before);
                    $rejected = 0;

                    $scrapingJob->markAsCompleted(
                        found: $stored,
                        stored: $stored,
                        duplicated: 0,
                        discoveredCount: $stored,
                        failedCount: 0,
                        processingTimeMs: $result['elapsed_ms'] ?? null,
                    );

                    $totalStored += $stored;
                    $totalRejected += $rejected;

                    $this->line("  ✓ Stored: {$stored} | Rejected: {$rejected}");
                } catch (\Exception $e) {
                    $this->error("  ✗ Error: {$e->getMessage()}");
                    Log::error('[ScrapeJobs] Scraping failed', [
                        'source' => $source->name,
                        'role'   => $role,
                        'error'  => $e->getMessage(),
                    ]);
                }
            }
        }

        $this->newLine();
        $this->info("═══════════════════════════════════════════════════");
        $this->info("  COMPLETE: {$totalStored} stored | {$totalRejected} rejected | {$totalSkipped} skipped");
        $this->info("═══════════════════════════════════════════════════");

        return 0;
    }

    // -----------------------------------------------------------------
    // URL template resolution
    // -----------------------------------------------------------------

    /**
     * Replace the {query} placeholder in a source endpoint with a
     * URL-encoded job role name.
     *
     * Returns the resolved URL, or NULL if the endpoint does not
     * contain the {query} placeholder.
     *
     * @param  string  $endpoint  e.g. "https://indeed.com/jobs?q={query}&l=Remote"
     * @param  string  $role      e.g. "Backend Developer"
     * @return string|null        e.g. "https://indeed.com/jobs?q=Backend%20Developer&l=Remote"
     */
    private function resolveQueryPlaceholder(string $endpoint, string $role): ?string
    {
        if (!str_contains($endpoint, self::QUERY_PLACEHOLDER)) {
            return null;
        }

        return str_replace(self::QUERY_PLACEHOLDER, rawurlencode($role), $endpoint);
    }

    /**
     * Resolve which roles to scrape from CLI args or the database.
     *
     * @param  array|null  $categories  Explicit categories from --categories flag.
     * @return array<string>
     */
    private function resolveRoles(?array $categories): array
    {
        if (!empty($categories)) {
            return $categories;
        }

        return TargetJobRole::where('is_active', true)
            ->pluck('name')
            ->toArray();
    }

}
