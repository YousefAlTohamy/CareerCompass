<?php

namespace App\Console\Commands;

use App\Models\Skill;
use App\Models\Job;
use App\Models\ScrapingSource;
use App\Models\TargetJobRole;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class ScrapeJobs extends Command
{
    protected $signature = 'jobs:scrape
                            {--count=20 : Number of jobs to fetch per source/role pair}
                            {--queue : Run scraping in background queue}
                            {--categories=* : Specific job categories to scrape}';
    protected $description = 'Scrape jobs from all active sources × target roles and store in database';

    // -----------------------------------------------------------------
    // Regex patterns that indicate a title is search metadata, not a
    // real job title. These act as the Laravel-side "last line of defence"
    // after the Python pipeline's cleaning.
    // -----------------------------------------------------------------
    private const TITLE_REJECTION_PATTERNS = [
        // "4,178,000+ jobs", "500 results", "1,200 positions"
        '/\d{1,3}(?:,\d{3})*\+?\s*(?:jobs?|results?|positions?|openings?|vacancies)/i',
        // "Results for software engineer"
        '/\bresults?\s+for\b/i',
        // "Showing 1-25 of 500"
        '/\bshowing\s+\d+\s*[-–—]\s*\d+/i',
        // "Page 1 of 50"
        '/\bpage\s+\d+\s+of\s+\d+/i',
        // "Jobs in New York", "Jobs near London"
        '/\bjobs?\s+(?:in|near|around)\s+[A-Z]/i',
        // "Browse 300+ jobs", "Search jobs", "Find careers"
        '/\b(?:browse|search|find|explore)\s+(?:\d+\+?\s*)?(?:jobs?|careers?)\b/i',
        // Pure numeric / punctuation strings
        '/^[\d\s,+.\-]+$/',
    ];

    // -----------------------------------------------------------------
    // Sentinel company names that should be treated as missing
    // -----------------------------------------------------------------
    private const INVALID_COMPANY_NAMES = [
        'unknown company',
        'unknown',
        'n/a',
        'none',
        'null',
        '',
    ];

    // -----------------------------------------------------------------
    // The placeholder token embedded in ScrapingSource endpoint URLs.
    // -----------------------------------------------------------------
    private const QUERY_PLACEHOLDER = '{query}';

    public function handle()
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

                // Build the source payload with the resolved endpoint
                $sourcePayload = [
                    'id'       => $source->id,
                    'name'     => $source->name,
                    'endpoint' => $resolvedEndpoint,
                    'type'     => $source->type,
                    'headers'  => $source->headers ?? [],
                    'params'   => $source->params  ?? [],
                ];

                try {
                    $result = $this->scrapeFromAI($role, $count, [$sourcePayload]);

                    if (!$result || empty($result['jobs'])) {
                        $this->line("  ⚠ No jobs returned.");
                        continue;
                    }

                    $stored = 0;
                    $rejected = 0;

                    foreach ($result['jobs'] as $jobData) {
                        // ── Gatekeeper validation ─────────────────────
                        $rejection = $this->validateJobData($jobData);

                        if ($rejection !== null) {
                            $rejected++;
                            $this->line("  REJECTED: \"{$jobData['title']}\" — {$rejection}");
                            Log::warning('[ScrapeJobs] Job rejected', [
                                'reason'  => $rejection,
                                'title'   => $jobData['title'] ?? '(empty)',
                                'company' => $jobData['company'] ?? null,
                                'url'     => $jobData['url'] ?? 'unknown',
                                'source'  => $source->name,
                                'role'    => $role,
                            ]);
                            continue;
                        }

                        $this->storeJob($jobData);
                        $stored++;
                    }

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

    // -----------------------------------------------------------------
    // AI Engine HTTP client
    // -----------------------------------------------------------------

    /**
     * Send a scrape request to the Python AI Engine.
     *
     * @param  string  $query       The search query (role name).
     * @param  int     $maxResults  Max jobs per source.
     * @param  array   $sources     Array of resolved source payloads.
     * @return array|null
     */
    private function scrapeFromAI(string $query, int $maxResults, array $sources): ?array
    {
        $aiEngineUrl = config('services.ai_engine.url', 'http://127.0.0.1:8002');
        $timeout = config('services.ai_engine.timeout', 120);

        $response = Http::timeout($timeout)
            ->retry(2, 500, function ($exception) {
                return $exception instanceof \Illuminate\Http\Client\ConnectionException ||
                    ($exception instanceof \Illuminate\Http\Client\RequestException &&
                        $exception->response &&
                        $exception->response->status() >= 500);
            })
            ->post("{$aiEngineUrl}/scrape-jobs", [
                'query'               => $query,
                'max_results'         => $maxResults,
                'use_samples'         => false,
                'calculate_statistics' => false,
                'sources'             => $sources,
            ]);

        if (!$response->successful()) {
            Log::error('[ScrapeJobs] AI Engine returned non-200', [
                'status' => $response->status(),
                'body'   => $response->body(),
            ]);
            return null;
        }

        return $response->json();
    }

    // -----------------------------------------------------------------
    // Validation — the "Gatekeeper" that rejects garbage data BEFORE
    // it reaches the database layer.
    // -----------------------------------------------------------------

    /**
     * Validate a single job data array before persistence.
     *
     * Returns NULL if the job passes all checks, or a human-readable
     * rejection reason string if it should be skipped.
     *
     * Checks applied:
     *   1. Title must be present and between 5–150 characters.
     *   2. Title must not match any search-metadata regex pattern.
     *   3. Title must not be a raw URL.
     *   4. Company must not be null or a known sentinel value
     *      (configurable — currently rejects "Unknown Company" etc.).
     *
     * @param  array  $jobData
     * @return string|null  Rejection reason, or null if valid.
     */
    private function validateJobData(array $jobData): ?string
    {
        // ── 1. Title presence & length ────────────────────────────────
        $title = trim($jobData['title'] ?? '');

        if ($title === '') {
            return 'Title is empty';
        }

        if (mb_strlen($title) < 5) {
            return "Title too short (" . mb_strlen($title) . " chars): \"{$title}\"";
        }

        if (mb_strlen($title) > 150) {
            return "Title too long (" . mb_strlen($title) . " chars): \""
                . mb_substr($title, 0, 80) . "…\"";
        }

        // ── 2. Title must not be a raw URL ────────────────────────────
        if (preg_match('#^https?://#i', $title)) {
            return "Title is a raw URL: \"{$title}\"";
        }

        // ── 3. Title must not match search-metadata patterns ──────────
        foreach (self::TITLE_REJECTION_PATTERNS as $pattern) {
            if (preg_match($pattern, $title)) {
                return "Title matches search-metadata pattern ({$pattern}): \"{$title}\"";
            }
        }

        // ── 4. Company validation ─────────────────────────────────────
        $company = trim($jobData['company'] ?? '');

        if ($company === '' || $company === null) {
            return "Company name is missing";
        }

        if (in_array(mb_strtolower($company), self::INVALID_COMPANY_NAMES, true)) {
            return "Company name is a sentinel value: \"{$company}\"";
        }

        // All checks passed
        return null;
    }

    // -----------------------------------------------------------------
    // Persistence
    // -----------------------------------------------------------------

    private function storeJob(array $jobData): Job
    {
        // Check for duplicate
        $existing = Job::where('url', $jobData['url'] ?? null)->first();

        if (!$existing) {
            $existing = Job::where('title', $jobData['title'])
                ->where('company', $jobData['company'])
                ->first();
        }

        if ($existing) {
            return $existing;
        }

        $now = Carbon::now();

        $job = Job::create([
            'title' => $jobData['title'],
            'company' => $jobData['company'] ?? 'Unknown',
            'description' => $jobData['description'] ?? '',
            'url' => $jobData['url'] ?? null,
            'source' => $jobData['source'] ?? 'unknown',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        // Attach skills
        if (isset($jobData['skills']) && is_array($jobData['skills'])) {
            $skillNames = collect($jobData['skills'])->pluck('name')->toArray();
            $skills = Skill::whereIn('name', $skillNames)->get();

            if ($skills->isNotEmpty()) {
                $job->skills()->sync($skills->pluck('id'));
            }
        }

        return $job;
    }
}
