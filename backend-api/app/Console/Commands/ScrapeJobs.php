<?php

namespace App\Console\Commands;

use App\Models\Skill;
use App\Models\Job;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class ScrapeJobs extends Command
{
    protected $signature = 'jobs:scrape
                            {--count=20 : Number of jobs to fetch per category}
                            {--queue : Run scraping in background queue}
                            {--categories=* : Specific job categories to scrape}';
    protected $description = 'Scrape jobs from AI Engine and store in database';

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
            $this->info('Categories: ' . implode(', ', $categories));

            \App\Jobs\ProcessMarketScraping::dispatch($categories, (int) $count);

            $this->info('✓ Scraping job dispatched to queue!');
            $this->info('Monitor with: php artisan queue:work');
            return 0;
        }

        // Run synchronously (original behavior for single category)
        if (empty($categories)) {
            $categories = \App\Models\TargetJobRole::where('is_active', true)->pluck('name')->toArray();
        }
        $query = $categories[0] ?? 'developer';
        $this->info("Fetching {$count} jobs for: {$query}...");

        $sources = \App\Models\ScrapingSource::where('status', 'active')->get()->toArray();

        try {
            $response = Http::timeout(60)
                ->post('http://127.0.0.1:8001/scrape-jobs', [
                    'query' => $query,
                    'max_results' => $count,
                    'use_samples' => false,
                    'sources' => $sources,
                ]);

            if (!$response->successful()) {
                $this->error('Failed to fetch jobs from AI Engine');
                return 1;
            }

            $data = $response->json();
            $jobs = $data['jobs'] ?? [];

            $this->info("Found {$data['total_jobs']} jobs");

            $stored = 0;
            $rejected = 0;

            foreach ($jobs as $jobData) {
                // ── Gatekeeper validation ─────────────────────────────
                $rejection = $this->validateJobData($jobData);

                if ($rejection !== null) {
                    $rejected++;
                    $sourceUrl = $jobData['url'] ?? 'unknown URL';
                    $rawTitle  = $jobData['title'] ?? '(empty)';

                    $this->warn("REJECTED: \"{$rawTitle}\" — {$rejection}");
                    Log::warning('[ScrapeJobs] Job rejected', [
                        'reason'  => $rejection,
                        'title'   => $rawTitle,
                        'company' => $jobData['company'] ?? null,
                        'url'     => $sourceUrl,
                    ]);
                    continue;
                }

                $this->storeJob($jobData);
                $stored++;
                $this->line("Stored: {$jobData['title']}");
            }

            $this->info("Successfully stored {$stored} jobs! ({$rejected} rejected)");
            return 0;
        } catch (\Exception $e) {
            $this->error('Error: ' . $e->getMessage());
            return 1;
        }
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
