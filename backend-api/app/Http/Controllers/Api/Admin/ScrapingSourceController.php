<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreScrapingSourceRequest;
use App\Http\Requests\UpdateScrapingSourceRequest;
use App\Http\Resources\ScrapingSourceResource;
use App\Models\ScrapingJob;
use App\Models\ScrapingSource;
use App\Models\TargetJobRole;
use App\Services\ScraperClient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class ScrapingSourceController extends Controller
{
    public function __construct(private readonly ScraperClient $scraperClient)
    {
    }

    public function getStatus()
    {
        $sources = ScrapingSource::query()->get();
        $statuses = [];

        foreach ($sources as $source) {
            $status = Cache::get("scraping_source_{$source->id}_status", [
                'is_scraping' => false,
                'status' => 'idle',
                'progress_percent' => 0,
                'count' => 0,
                'jobs_found' => 0,
                'jobs_stored' => 0,
                'failed_count' => 0,
                'message' => 'Idle',
            ]);

            $statuses[$source->id] = array_merge([
                'source_id' => $source->id,
                'source_name' => $source->name,
                'is_active' => $source->isActive(),
                'is_scraping' => false,
                'status' => 'idle',
                'progress_percent' => 0,
                'target' => null,
                'query' => null,
                'scraping_job_id' => null,
                'jobs_found' => 0,
                'jobs_stored' => 0,
                'failed_count' => 0,
                'elapsed_seconds' => 0,
                'message' => 'Idle',
                'last_error' => null,
                'last_updated_at' => now()->toIso8601String(),
            ], $status);
        }

        $recentJobs = ScrapingJob::query()
            ->where('created_at', '>=', now()->subHours(2));

        $activeJobs = (clone $recentJobs)->whereIn('status', ['pending', 'processing'])->count();
        $completedJobs = (clone $recentJobs)->where('status', 'completed')->count();
        $failedJobs = (clone $recentJobs)->where('status', 'failed')->count();
        $activeSources = ScrapingSource::active()->count();
        $activeTargets = TargetJobRole::where('is_active', true)->count();
        $plannedRuns = $activeSources * $activeTargets;
        $observedRuns = $activeJobs + $completedJobs + $failedJobs;
        $progressDenominator = max($plannedRuns, $observedRuns);
        $progressPercent = $progressDenominator > 0
            ? min(100, (int) round((($completedJobs + $failedJobs) / $progressDenominator) * 100))
            : 0;

        return response()->json([
            'success' => true,
            'data' => [
                'summary' => [
                    'is_any_scraping' => $activeJobs > 0 || collect($statuses)->contains(fn ($status) => (bool) ($status['is_scraping'] ?? false)),
                    'active_sources' => $activeSources,
                    'active_targets' => $activeTargets,
                    'planned_runs' => $plannedRuns,
                    'active_jobs' => $activeJobs,
                    'completed_jobs' => $completedJobs,
                    'failed_jobs' => $failedJobs,
                    'progress_percent' => $progressPercent,
                    'last_updated_at' => now()->toIso8601String(),
                ],
                'sources' => $statuses,
            ],
        ]);
    }
    public function index(Request $request)
    {
        $query = ScrapingSource::query();

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('endpoint', 'like', "%{$search}%")
                    ->orWhere('type', 'like', "%{$search}%");
            });
        }

        $sources = $query->orderBy('created_at', 'desc')->paginate(10);
        return ScrapingSourceResource::collection($sources);
    }

    public function store(StoreScrapingSourceRequest $request)
    {
        $validated = $request->validated();
        $status = ($validated['is_active'] ?? true) ? 'active' : 'inactive';

        $source = ScrapingSource::create([
            'name' => $validated['name'],
            'type' => $validated['type'],
            'mode' => $validated['mode'] ?? 'static',
            'pattern' => $validated['pattern'] ?? null,
            'endpoint' => $validated['endpoint'],
            'method' => $validated['method'] ?? 'GET',
            'headers' => $validated['headers'] ?? [],
            'params' => $validated['params'] ?? [],
            'status' => $status,
        ]);

        return new ScrapingSourceResource($source);
    }

    public function update(UpdateScrapingSourceRequest $request, ScrapingSource $scrapingSource)
    {
        $data = $request->validated();
        if (isset($data['is_active'])) {
            $data['status'] = $data['is_active'] ? 'active' : 'inactive';
            unset($data['is_active']);
        }

        $scrapingSource->update($data);

        return new ScrapingSourceResource($scrapingSource);
    }

    public function destroy(ScrapingSource $scrapingSource)
    {
        $scrapingSource->delete();
        return response()->json(null, 204);
    }

    public function toggleStatus(ScrapingSource $scrapingSource)
    {
        $scrapingSource->toggle();
        return new ScrapingSourceResource($scrapingSource);
    }

    public function test()
    {
        set_time_limit(300);

        try {
            $sources = ScrapingSource::active()->orderBy('id')->get();
            if ($sources->isEmpty()) {
                return response()->json([
                    'success' => false,
                    'overall_status' => 'no_active_sources',
                    'diagnostic_query' => 'Software',
                    'total_sources' => 0,
                    'passed_sources' => 0,
                    'failed_sources' => 0,
                    'results' => [],
                    'message' => 'No active sources found for diagnostics.',
                    'output' => 'No active sources found for diagnostics.',
                ]);
            }

            $results = $sources
                ->map(fn (ScrapingSource $source): array => $this->runSourceDiagnostic($source))
                ->values()
                ->all();

            $passed = collect($results)->where('success', true)->count();
            $failed = count($results) - $passed;
            $overallStatus = $failed === 0 ? 'passed' : ($passed > 0 ? 'partial_failure' : 'failed');

            return response()->json([
                'success' => $failed === 0,
                'overall_status' => $overallStatus,
                'diagnostic_query' => 'Software',
                'total_sources' => count($results),
                'passed_sources' => $passed,
                'failed_sources' => $failed,
                'results' => $results,
                'message' => $failed === 0
                    ? 'All active sources passed diagnostics.'
                    : ($passed > 0 ? 'Some active sources failed diagnostics.' : 'All active sources failed diagnostics.'),
                'output' => $this->formatDiagnosticOutput($results),
            ]);
        } catch (\Exception $e) {
            Log::error("Error running global scrape test: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'output' => "Error running command: " . $e->getMessage()
            ], 500);
        }
    }

    public function testSingle($id)
    {
        set_time_limit(300);
        try {
            $source = ScrapingSource::findOrFail($id);
            $result = $this->runSourceDiagnostic($source);

            return response()->json([
                'success' => (bool) $result['success'],
                'overall_status' => $result['success'] ? 'passed' : 'failed',
                'diagnostic_query' => 'Software',
                'total_sources' => 1,
                'passed_sources' => $result['success'] ? 1 : 0,
                'failed_sources' => $result['success'] ? 0 : 1,
                'results' => [$result],
                'message' => $result['success']
                    ? 'Selected source passed diagnostics.'
                    : 'Selected source failed diagnostics.',
                'output' => $this->formatDiagnosticOutput([$result]),
            ]);
        } catch (\Exception $e) {
            Log::error("Error testing single source: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'output' => "Error running command: " . $e->getMessage()
            ], 500);
        }
    }

    private function runSourceDiagnostic(ScrapingSource $source): array
    {
        $scrapingJob = ScrapingJob::create([
            'job_title' => 'Software',
            'type' => 'on_demand',
            'status' => 'processing',
            'started_at' => now(),
        ]);

        $started = microtime(true);
        $result = [];
        $output = '';

        try {
            $result = $this->scraperClient->scrape(
                query: 'Software',
                limit: 1,
                scrapingJobId: $scrapingJob->id,
                sourceId: $source->id,
                allowFailure: true,
            );

            $output = trim(($result['stdout'] ?? '') . "\n" . ($result['stderr'] ?? ''));
        } catch (\Throwable $e) {
            $output = $e->getMessage();
            $result = [
                'success' => false,
                'classification' => 'EXTERNAL_FAILED',
                'error_summary' => $e->getMessage(),
            ];
        }

        $reportedFailure = Str::contains($output, $this->failureSignals(), false);
        $classification = (string) ($result['classification'] ?? $this->classifyDiagnosticResult($result, $reportedFailure));
        if ($reportedFailure && ($result['success'] ?? false)) {
            $classification = 'INTEGRITY_COMPROMISED';
            $output = "Scraper finished, but diagnostics detected failed URLs or runtime errors.\n\n{$output}";
        }

        $failedUrlsCount = (int) ($result['failed_urls_count']
            ?? $scrapingJob->failedUrls()->count());
        $jobsStored = (int) ($result['jobs_stored'] ?? 0);
        $success = (bool) ($result['success'] ?? false)
            && !in_array($classification, ['EXTERNAL_FAILED', 'UNSUPPORTED', 'CONFIG_INVALID', 'INTEGRITY_COMPROMISED'], true);

        $success
            ? $scrapingJob->markAsCompleted($jobsStored, $jobsStored, 0, $jobsStored, $failedUrlsCount, $result['elapsed_ms'] ?? null)
            : $scrapingJob->markAsFailed($output ?: 'Scraper test failed');

        return [
            'source_id' => $source->id,
            'source_name' => $source->name,
            'source_type' => $source->type,
            'source_mode' => $source->mode ?? 'static',
            'source_status' => $source->status,
            'endpoint_used' => (string) ($result['endpoint_used'] ?? $this->endpointForQuery($source, 'Software')),
            'diagnostic_query' => 'Software',
            'success' => $success,
            'status' => $this->statusForClassification($classification),
            'classification' => $classification,
            'jobs_preview_count' => (int) ($result['jobs_preview_count'] ?? 0),
            'jobs_stored' => $jobsStored,
            'failed_urls_count' => $failedUrlsCount,
            'elapsed_ms' => (int) ($result['elapsed_ms'] ?? round((microtime(true) - $started) * 1000)),
            'error_summary' => $result['error_summary'] ?? ($success ? null : mb_substr($output, 0, 500)),
            'output_excerpt' => mb_substr($output, 0, 4000),
            'scraping_job_id' => $scrapingJob->id,
        ];
    }

    private function failureSignals(): array
    {
        return [
            'CRITICAL ERROR',
            'Successfully reported failure to DLQ',
            'downloader/exception_count',
            'log_count/ERROR',
            'Traceback (most recent call last)',
            'Page.goto: net::ERR_TIMED_OUT',
        ];
    }

    private function classifyDiagnosticResult(array $result, bool $reportedFailure): string
    {
        if ($reportedFailure) {
            return 'INTEGRITY_COMPROMISED';
        }

        $success = (bool) ($result['success'] ?? false);
        $stored = (int) ($result['jobs_stored'] ?? 0);
        $failed = (int) ($result['failed_urls_count'] ?? 0);

        if ($success && $stored > 0 && $failed === 0) {
            return 'SUCCESS';
        }

        if ($success && $stored > 0 && $failed > 0) {
            return 'PARTIAL_SUCCESS';
        }

        if ($success && $stored === 0 && $failed === 0) {
            return 'EMPTY_SUCCESS';
        }

        return $failed > 0 ? 'EXTERNAL_FAILED' : 'UNSUPPORTED';
    }

    private function statusForClassification(string $classification): string
    {
        return match ($classification) {
            'SUCCESS' => 'passed',
            'PARTIAL_SUCCESS' => 'partial_success',
            'EMPTY_SUCCESS' => 'empty_success',
            'UNSUPPORTED' => 'unsupported',
            'CONFIG_INVALID' => 'config_invalid',
            'INTEGRITY_COMPROMISED' => 'integrity_compromised',
            default => 'external_failed',
        };
    }

    private function endpointForQuery(ScrapingSource $source, string $query): string
    {
        return str_replace('{query}', rawurlencode($query), (string) $source->endpoint);
    }

    private function formatDiagnosticOutput(array $results): string
    {
        return collect($results)
            ->map(function (array $result): string {
                $line = sprintf(
                    '[%s] %s (%s) query="%s" stored=%d failed_urls=%d endpoint=%s',
                    $result['classification'] ?? 'UNKNOWN',
                    $result['source_name'] ?? 'Unknown Source',
                    $result['source_type'] ?? 'unknown',
                    $result['diagnostic_query'] ?? 'Software',
                    $result['jobs_stored'] ?? 0,
                    $result['failed_urls_count'] ?? 0,
                    $result['endpoint_used'] ?? 'n/a',
                );

                if (!empty($result['error_summary'])) {
                    $line .= "\n  error: " . $result['error_summary'];
                }

                return $line;
            })
            ->implode("\n\n");
    }
}
