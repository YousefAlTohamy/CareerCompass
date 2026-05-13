<?php

namespace App\Console\Commands;

use App\Models\Job;
use App\Models\ScrapingJob;
use App\Models\ScrapingSource;
use App\Services\ScraperClient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class TestScrapingSources extends Command
{
    /**
     * The placeholder token embedded in ScrapingSource endpoint URLs.
     */
    private const QUERY_PLACEHOLDER = '{query}';

    /**
     * Default search keyword used when testing sources.
     * Chosen to be broad enough to return results on any job board.
     */
    private const DEFAULT_TEST_QUERY = 'Software Engineer';
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'scrape:test-sources
                            {--source= : Test a single source by ID}
                            {--query=developer : Search query to use when testing HTML sources}
                            {--timeout=30 : HTTP timeout in seconds per source}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Test all active scraping sources and report if they return live data';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->newLine();
        $this->line('  <fg=cyan;options=bold>CareerCompass — Scraping Source Diagnostics</>');
        $this->line('  ' . str_repeat('─', 50));
        $this->newLine();

        // ── 1. Load sources ─────────────────────────────────────────────────
        $query = ScrapingSource::where('status', 'active');

        if ($onlyId = $this->option('source')) {
            $query->where('id', $onlyId);
        }

        $sources = $query->get();

        if ($sources->isEmpty()) {
            $this->warn('  No active scraping sources found in the database.');
            $this->line('  Run <fg=yellow>php artisan db:seed --class=ScrapingSourceSeeder</> to add test data.');
            $this->newLine();
            return self::FAILURE;
        }

        $this->line("  Found <fg=yellow>{$sources->count()}</> active source(s). Running tests…");
        $this->newLine();

        // ── 2. Loop & test ──────────────────────────────────────────────────
        $passed  = 0;
        $failed  = 0;
        $timeout = (int) $this->option('timeout');
        $testQuery = $this->option('query');

        foreach ($sources as $source) {
            // ── Resolve {query} placeholder in the endpoint URL ──────
            $resolvedEndpoint = $source->endpoint;

            if (str_contains($resolvedEndpoint, self::QUERY_PLACEHOLDER)) {
                $resolvedEndpoint = str_replace(
                    self::QUERY_PLACEHOLDER,
                    rawurlencode($testQuery),
                    $resolvedEndpoint
                );
                $this->line("  <fg=yellow>Using test query:</> <fg=white;options=bold>{$testQuery}</> → {$resolvedEndpoint}");
            }

            $this->line("  <options=bold>Testing:</> {$source->name} <fg=gray>[{$source->type}]</>");

            try {
                $result = match ($source->type) {
                    'api'  => $this->testApiSource($source, $resolvedEndpoint, $timeout),
                    'html', 'spa' => $this->testHtmlSource($source, $resolvedEndpoint, $testQuery, $timeout),
                    default => ['ok' => false, 'error' => "Unknown source type '{$source->type}'"],
                };

                if ($result['ok']) {
                    $passed++;
                    $this->line("  <fg=green>  ✔ SUCCESS</> — {$result['message']}");
                    if (!empty($result['sample'])) {
                        $this->line("  <fg=green>  ↳ First result:</> <fg=white>{$result['sample']}</>");
                    }
                } else {
                    $failed++;
                    $this->line("  <fg=red>  ✘ FAILED</>  — {$result['error']}");
                }
            } catch (\Throwable $e) {
                $failed++;
                $this->line("  <fg=red>  ✘ CRITICAL ERROR</> — {$e->getMessage()}");
                $this->line("  <fg=gray>    " . $e->getFile() . ':' . $e->getLine() . "</>");
            }

            $this->newLine();
        }

        // ── 3. Summary ──────────────────────────────────────────────────────
        $this->line('  ' . str_repeat('─', 50));
        $total = $passed + $failed;
        $color = $failed === 0 ? 'green' : ($passed === 0 ? 'red' : 'yellow');
        $this->line("  <fg={$color};options=bold>Results: {$passed}/{$total} sources passed.</>");
        $this->newLine();

        return $failed === 0 ? self::SUCCESS : self::FAILURE;
    }

    // ────────────────────────────────────────────────────────────────────────
    // API Source Test
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @param ScrapingSource $source
     * @param string $resolvedEndpoint  The endpoint URL with {query} already resolved.
     * @param int $timeout
     * @return array
     */
    private function testApiSource($source, string $resolvedEndpoint, int $timeout): array
    {
        // ── Adzuna: delegate to the Python engine ────────────────────────────
        // Reason: Cloudflare/Chef does TLS fingerprinting. Guzzle's TLS stack
        // is always detected as non-browser regardless of headers. The Python
        // engine (httpx) uses different TLS behaviour and already reads Adzuna
        // credentials from its own .env / environment variables.
        if (str_contains($resolvedEndpoint, 'adzuna.com')) {
            return $this->testHtmlSource($source, $resolvedEndpoint, self::DEFAULT_TEST_QUERY, $timeout);
        }

        // ── All other API sources: call directly via Guzzle ──────────────────
        try {
            $headers = $source->headers ?: [];
            $params  = $source->params  ?: [];

            // Always limit to a small result set for speed
            $params = array_merge($params, ['limit' => 2, 'search' => 'developer']);

            // Spoof a browser User-Agent as a general best-practice
            $headers = array_merge($headers, [
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept'     => 'application/json',
            ]);

            $response = Http::timeout($timeout)
                ->withoutVerifying()
                ->withHeaders($headers)
                ->get($resolvedEndpoint, $params);

            if (!$response->successful()) {
                return [
                    'ok'    => false,
                    'error' => "HTTP {$response->status()} — " . $this->extractError($response->body()),
                ];
            }

            $body = $response->json();

            // Try common container keys used by different APIs
            $items = $body['jobs']   ??
                $body['results'] ??
                $body['data']    ??
                (is_array($body) ? $body : []);

            if (empty($items)) {
                return [
                    'ok'    => false,
                    'error' => 'API responded 200 but returned 0 items. Response keys: [' . implode(', ', array_keys($body)) . ']',
                ];
            }

            $first      = $items[0] ?? [];
            $firstTitle = $first['title'] ?? $first['name'] ?? $first['position'] ?? '(no title key found)';
            $count      = count($items);

            return [
                'ok'      => true,
                'message' => "{$count} item(s) returned",
                'sample'  => "\"{$firstTitle}\"",
            ];
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            return ['ok' => false, 'error' => "Connection refused / timeout: {$e->getMessage()}"];
        } catch (\Exception $e) {
            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // HTML Source Test  (delegates to the Python scraper service)
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @param ScrapingSource $source
     * @param string $resolvedEndpoint  The endpoint URL with {query} already resolved.
     * @param string $query
     * @param int $timeout
     * @return array
     */
    private function testHtmlSource($source, string $resolvedEndpoint, $query, int $timeout): array
    {
        try {
            $before = Job::where('scraping_source_id', $source->id)->count();
            $scrapingJob = ScrapingJob::create([
                'job_title' => (string) $query,
                'type' => 'on_demand',
                'status' => 'processing',
                'started_at' => now(),
            ]);

            app(ScraperClient::class)->scrape(
                query: (string) $query,
                limit: 2,
                scrapingJobId: $scrapingJob->id,
                sourceId: $source->id,
            );

            sleep(2);
            $jobs = Job::where('scraping_source_id', $source->id)->latest()->take(2)->get();
            $count = max(0, Job::where('scraping_source_id', $source->id)->count() - $before);

            if ($jobs->isEmpty()) {
                $scrapingJob->markAsCompleted(0, 0, 0, 0, 0);
                return ['ok' => false, 'error' => 'No jobs returned. The site may be blocking the scraper.'];
            }

            $scrapingJob->markAsCompleted($count, $count, 0, $count, 0);
            $firstTitle = $jobs->first()->title ?? '(no title)';

            return [
                'ok'      => true,
                'message' => "{$count} new job(s) imported via scraper service",
                'sample'  => "\"{$firstTitle}\"",
            ];
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            return [
                'ok'    => false,
                'error' => "Cannot reach scraper service at " . config('services.scraper_service.url', 'http://127.0.0.1:8003') .
                    " — is it running? ({$e->getMessage()})",
            ];
        } catch (\Exception $e) {
            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────────────────────────────

    private function extractError(string $body): string
    {
        $decoded = json_decode($body, true);
        if (is_array($decoded)) {
            $msg = $decoded['message'] ?? $decoded['detail'] ?? $decoded['error'] ?? null;
            if (is_array($msg)) {
                return json_encode($msg);
            }
            if (is_string($msg)) {
                return $msg;
            }
        }
        return substr($body, 0, 150);
    }
}
