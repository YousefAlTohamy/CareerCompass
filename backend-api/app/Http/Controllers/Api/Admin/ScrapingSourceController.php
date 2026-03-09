<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ScrapingSourceResource;
use App\Models\ScrapingSource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;

class ScrapingSourceController extends Controller
{
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

        $sources = $query->orderBy('created_at', 'desc')->paginate(15);
        return ScrapingSourceResource::collection($sources);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:api,html',
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
            'type' => 'sometimes|in:api,html',
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
        set_time_limit(300); // Allow up to 5 minutes for the test command

        try {
            // Run the command and capture output
            Artisan::call('scrape:test-sources', ['--timeout' => 45]);
            $output = Artisan::output();

            // Basic heuristic to determine success
            $success = !str_contains($output, 'CRITICAL ERROR') && str_contains($output, 'Results:');

            return response()->json([
                'success' => $success,
                'output' => $output
            ]);
        } catch (\Exception $e) {
            Log::error("Error running scrape test: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'output' => "Error running command: " . $e->getMessage()
            ], 500);
        }
    }
}
