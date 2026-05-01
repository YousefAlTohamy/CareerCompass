<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ScrapingSourceResource;
use App\Models\ScrapingSource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Process;

class ScrapingSourceController extends Controller
{
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

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:api,html,spa',
            'mode' => 'sometimes|in:static,discovery',
            'pattern' => 'nullable|string|max:512',
            'endpoint' => 'required|url',
            'method' => 'required|in:GET,POST',
            'headers' => 'nullable|array',
            'params' => 'nullable|array',
            'is_active' => 'boolean',
        ]);

        // Map boolean is_active to string status
        $status = ($validated['is_active'] ?? true) ? 'active' : 'inactive';

        $source = ScrapingSource::create([
            'name' => $validated['name'],
            'type' => $validated['type'],
            'mode' => $validated['mode'] ?? 'static',
            'pattern' => $validated['pattern'] ?? null,
            'endpoint' => $validated['endpoint'],
            'method' => $validated['method'],
            'headers' => $validated['headers'] ?? [],
            'params' => $validated['params'] ?? [],
            'status' => $status,
        ]);

        return new ScrapingSourceResource($source);
    }

    public function update(Request $request, ScrapingSource $scrapingSource)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'type' => 'sometimes|in:api,html,spa',
            'mode' => 'sometimes|in:static,discovery',
            'pattern' => 'nullable|string|max:512',
            'endpoint' => 'sometimes|url',
            'method' => 'sometimes|in:GET,POST',
            'headers' => 'nullable|array',
            'params' => 'nullable|array',
            'is_active' => 'boolean',
        ]);

        $data = $validated;

        // Handle is_active -> status mapping if present
        if (isset($validated['is_active'])) {
            $data['status'] = $validated['is_active'] ? 'active' : 'inactive';
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
        $scrapyPath = base_path('../ai-job-miner');
        $command = [
            'scrapy', 'crawl', 'linkedin', 
            '-a', 'query=Software',
            '-a', 'limit=1',
            '-a', 'source_id=' . $source->id
        ];

        $process = Process::path($scrapyPath)
            ->env([
                'LARAVEL_API_TOKEN' => config('services.scrapy.token', 'YOUR_SANCTUM_TOKEN'),
                'LARAVEL_API_URL' => url('/api/jobs/import'),
                'LARAVEL_API_CHECK_URL' => url('/api/jobs/import/check'),
                'LARAVEL_API_FAILED_URL' => url('/api/jobs/import/failed'),
                'LARAVEL_API_PROXIES_URL' => url('/api/proxies/active'),
            ])
            ->timeout(60)
            ->run($command);

        $output = $process->output() . "\n" . $process->errorOutput();
        $success = $process->successful() && !str_contains($output, 'CRITICAL ERROR');

        return response()->json([
            'success' => $success,
            'output' => $output
        ]);
    }
}
