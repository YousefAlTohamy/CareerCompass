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
                'jobs_quality_rejected_count' => 0,
                'classification' => null,
                'quality_warnings' => [],
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
                'jobs_quality_rejected_count' => 0,
                'classification' => null,
                'quality_warnings' => [],
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
        $activeSources = ScrapingSource::active()->get();
        $runnableSources = $activeSources
            ->filter(fn (ScrapingSource $source): bool => (bool) ($source->supportMetadata()['is_runnable'] ?? false))
            ->count();
        $activeTargets = TargetJobRole::where('is_active', true)->count();
        $plannedRuns = $runnableSources * $activeTargets;
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
                    'active_sources' => $activeSources->count(),
                    'runnable_sources' => $runnableSources,
                    'skipped_sources' => max(0, $activeSources->count() - $runnableSources),
                    'active_targets' => $activeTargets,
                    'planned_runs' => $plannedRuns,
                    'observed_recent_jobs' => $observedRuns,
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

            $summary = $this->summarizeDiagnosticResults($results);

            return response()->json([
                'success' => $summary['overall_status'] === 'HEALTHY',
                'pipeline_working' => $summary['pipeline_working'],
                'overall_status' => $summary['overall_status'],
                'diagnostic_query' => 'Software',
                'total_sources' => count($results),
                'passed_sources' => $summary['passed_sources'],
                'failed_sources' => $summary['failed_sources'],
                'config_required_sources' => $summary['config_required_sources'],
                'adapter_missing_sources' => $summary['adapter_missing_sources'],
                'external_issue_sources' => $summary['external_issue_sources'],
                'results' => $results,
                'message' => $summary['message'],
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
                'pipeline_working' => (bool) $result['success'],
                'overall_status' => $result['success'] ? 'HEALTHY' : (string) ($result['classification'] ?? 'FAILED'),
                'diagnostic_query' => 'Software',
                'total_sources' => 1,
                'passed_sources' => $result['success'] ? 1 : 0,
                'failed_sources' => $result['success'] ? 0 : 1,
                'config_required_sources' => ($result['classification'] ?? null) === 'CONFIG_REQUIRED' ? 1 : 0,
                'adapter_missing_sources' => in_array(($result['classification'] ?? null), ['ADAPTER_MISSING', 'UNSUPPORTED'], true) ? 1 : 0,
                'external_issue_sources' => in_array(($result['classification'] ?? null), ['EXTERNAL_FAILED', 'EXTERNAL_BLOCKED', 'INTEGRITY_COMPROMISED', 'EMPTY_RESULT', 'DATA_QUALITY_FAILED'], true) ? 1 : 0,
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
        $support = $source->supportMetadata();
        $success = (bool) ($result['success'] ?? false)
            && !in_array($classification, [
                'EXTERNAL_FAILED',
                'EXTERNAL_BLOCKED',
                'UNSUPPORTED',
                'ADAPTER_MISSING',
                'CONFIG_INVALID',
                'CONFIG_REQUIRED',
                'INTEGRITY_COMPROMISED',
                'EMPTY_RESULT',
                'DATA_QUALITY_FAILED',
            ], true);

        $success
            ? $scrapingJob->markAsCompleted($jobsStored, $jobsStored, 0, $jobsStored, $failedUrlsCount, $result['elapsed_ms'] ?? null)
            : $scrapingJob->markAsFailed($output ?: 'Scraper test failed');

        return [
            'source_id' => $source->id,
            'source_name' => $source->name,
            'source_type' => $source->type,
            'source_mode' => $source->mode ?? 'static',
            'source_status' => $source->status,
            'support_status' => $support['support_status'] ?? 'unknown',
            'adapter_mode' => $support['adapter_mode'] ?? 'adapter_missing',
            'adapter_name' => $result['adapter_name'] ?? ($support['adapter_name'] ?? $source->adapterName()),
            'requires_credentials' => (bool) ($support['requires_credentials'] ?? false),
            'requires_proxy' => (bool) ($support['requires_proxy'] ?? false),
            'recommended_action' => $support['recommended_action'] ?? null,
            'implementation_notes' => $support['implementation_notes'] ?? null,
            'endpoint_used' => (string) ($result['endpoint_used'] ?? $this->endpointForQuery($source, 'Software')),
            'diagnostic_query' => 'Software',
            'success' => $success,
            'status' => $this->statusForClassification($classification),
            'classification' => $classification,
            'jobs_preview_count' => (int) ($result['jobs_preview_count'] ?? 0),
            'jobs_stored' => $jobsStored,
            'jobs_quality_rejected_count' => (int) ($result['jobs_quality_rejected_count'] ?? 0),
            'quality_warnings' => $result['quality_warnings'] ?? [],
            'rejected_examples' => $result['rejected_examples'] ?? [],
            'data_quality_summary' => $result['data_quality_summary'] ?? null,
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
            return 'EMPTY_RESULT';
        }

        return $failed > 0 ? 'EXTERNAL_FAILED' : 'ADAPTER_MISSING';
    }

    private function statusForClassification(string $classification): string
    {
        return match ($classification) {
            'SUCCESS' => 'passed',
            'PARTIAL_SUCCESS' => 'partial_success',
            'EMPTY_RESULT' => 'empty_result',
            'DATA_QUALITY_FAILED' => 'data_quality_failed',
            'UNSUPPORTED', 'ADAPTER_MISSING' => 'adapter_missing',
            'CONFIG_REQUIRED' => 'config_required',
            'CONFIG_INVALID' => 'config_invalid',
            'EXTERNAL_BLOCKED' => 'external_blocked',
            'INTEGRITY_COMPROMISED' => 'integrity_compromised',
            default => 'external_failed',
        };
    }

    private function summarizeDiagnosticResults(array $results): array
    {
        $collection = collect($results);
        $passClassifications = ['SUCCESS', 'PARTIAL_SUCCESS'];
        $configClassifications = ['CONFIG_REQUIRED', 'CONFIG_INVALID'];
        $adapterClassifications = ['ADAPTER_MISSING', 'UNSUPPORTED'];
        $externalClassifications = ['EXTERNAL_FAILED', 'EXTERNAL_BLOCKED', 'INTEGRITY_COMPROMISED', 'EMPTY_RESULT', 'DATA_QUALITY_FAILED'];

        $passed = $collection
            ->filter(fn (array $result): bool => in_array((string) ($result['classification'] ?? ''), $passClassifications, true))
            ->count();
        $configRequired = $collection
            ->filter(fn (array $result): bool => in_array((string) ($result['classification'] ?? ''), $configClassifications, true))
            ->count();
        $adapterMissing = $collection
            ->filter(fn (array $result): bool => in_array((string) ($result['classification'] ?? ''), $adapterClassifications, true))
            ->count();
        $externalIssues = $collection
            ->filter(fn (array $result): bool => in_array((string) ($result['classification'] ?? ''), $externalClassifications, true))
            ->count();
        $failed = $collection->count() - $passed;

        $overall = match (true) {
            $collection->isEmpty() => 'NO_ACTIVE_SOURCES',
            $passed === $collection->count() => 'HEALTHY',
            $passed > 0 => 'DEGRADED',
            $configRequired === $collection->count() => 'CONFIG_REQUIRED',
            default => 'FAILED',
        };

        $message = match ($overall) {
            'HEALTHY' => 'Diagnostics completed: HEALTHY. All runnable active sources passed.',
            'DEGRADED' => sprintf(
                'Diagnostics completed: DEGRADED. Pipeline is working because %d source(s) passed; %d source(s) need credentials, adapters, proxy fixes, or external access.',
                $passed,
                $failed,
            ),
            'CONFIG_REQUIRED' => 'Diagnostics completed: CONFIG_REQUIRED. Active sources need credentials before they can run.',
            'NO_ACTIVE_SOURCES' => 'No active sources found for diagnostics.',
            default => 'Diagnostics completed: FAILED. No active source produced a healthy diagnostic result.',
        };

        return [
            'overall_status' => $overall,
            'pipeline_working' => $passed > 0,
            'passed_sources' => $passed,
            'failed_sources' => $failed,
            'config_required_sources' => $configRequired,
            'adapter_missing_sources' => $adapterMissing,
            'external_issue_sources' => $externalIssues,
            'message' => $message,
        ];
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

                if (($result['jobs_quality_rejected_count'] ?? 0) > 0) {
                    $line .= sprintf("\n  quality_rejected=%d", $result['jobs_quality_rejected_count']);
                }

                if (!empty($result['error_summary'])) {
                    $line .= "\n  error: " . $result['error_summary'];
                }

                return $line;
            })
            ->implode("\n\n");
    }
}
