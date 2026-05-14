<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreScrapingSourceRequest;
use App\Http\Requests\UpdateScrapingSourceRequest;
use App\Http\Resources\ScrapingSourceResource;
use App\Models\ScrapingJob;
use App\Models\ScrapingSource;
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
        $sources = ScrapingSource::active()->get();
        $statuses = [];
        foreach ($sources as $source) {
            $status = Cache::get("scraping_source_{$source->id}_status", [
                'is_scraping' => false,
                'count' => 0
            ]);
            $statuses[$source->id] = $status;
        }
        return response()->json(['success' => true, 'data' => $statuses]);
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
            // Run global diagnostics: just testing the first active source as a sample
            $source = ScrapingSource::active()->first();
            if (!$source) {
                return response()->json([
                    'success' => false,
                    'output' => "No active sources found for testing."
                ]);
            }
            
            return $this->runScrapyTest($source);
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
            return $this->runScrapyTest($source);
        } catch (\Exception $e) {
            Log::error("Error testing single source: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'output' => "Error running command: " . $e->getMessage()
            ], 500);
        }
    }

    private function runScrapyTest(ScrapingSource $source)
    {
        $scrapingJob = ScrapingJob::create([
            'job_title' => 'Software',
            'type' => 'on_demand',
            'status' => 'processing',
            'started_at' => now(),
        ]);

        $result = $this->scraperClient->scrape(
            query: 'Software',
            limit: 1,
            scrapingJobId: $scrapingJob->id,
            sourceId: $source->id,
        );

        $output = trim(($result['stdout'] ?? '') . "\n" . ($result['stderr'] ?? ''));
        $failureSignals = [
            'CRITICAL ERROR',
            'Successfully reported failure to DLQ',
            'downloader/exception_count',
            'log_count/ERROR',
            'Traceback (most recent call last)',
        ];
        $reportedFailure = Str::contains($output, $failureSignals, false);
        $success = (bool) ($result['success'] ?? false) && !$reportedFailure;

        if (!$success && (bool) ($result['success'] ?? false) && $reportedFailure) {
            $output = "Scraper finished, but diagnostics detected failed URLs or runtime errors.\n\n{$output}";
        }

        $success
            ? $scrapingJob->markAsCompleted(1, 0, 0, 1, 0, $result['elapsed_ms'] ?? null)
            : $scrapingJob->markAsFailed($output ?: 'Scraper test failed');

        return response()->json([
            'success' => $success,
            'output' => $output
        ]);
    }
}
