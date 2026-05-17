<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessMarketScrapingCategory;
use App\Models\ScrapingSource;
use App\Models\TargetJobRole;
use Illuminate\Bus\Batch;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Log;
use Throwable;

class TargetJobRoleController extends Controller
{
    public function index(Request $request)
    {
        $query = TargetJobRole::query();

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where('name', 'like', "%{$search}%");
        }

        $roles = $query->orderBy('created_at', 'desc')->paginate(10);
        return response()->json($roles);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|unique:target_job_roles,name',
            'is_active' => 'boolean',
        ]);

        $role = TargetJobRole::create([
            'name' => $request->name,
            'is_active' => $request->is_active ?? true,
        ]);

        return response()->json(['message' => 'Role added successfully', 'data' => $role], 201);
    }

    public function toggleActive($id)
    {
        $role = TargetJobRole::findOrFail($id);
        $role->is_active = !$role->is_active;
        $role->save();

        return response()->json(['message' => 'Role status updated successfully', 'data' => $role]);
    }

    public function destroy($id)
    {
        $role = TargetJobRole::findOrFail($id);
        $role->delete();

        return response()->json(['message' => 'Role deleted successfully']);
    }

    public function runFullScraping()
    {
        $targets = TargetJobRole::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'search_query']);

        $sources = ScrapingSource::active()
            ->orderBy('id')
            ->get(['id', 'name', 'endpoint', 'method', 'type', 'headers', 'params', 'mode', 'pattern', 'status']);

        if ($sources->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'No active scraping sources found. Activate at least one source before running extractions.',
                'active_sources' => 0,
                'active_targets' => $targets->count(),
                'planned_runs' => 0,
            ], 422);
        }

        if ($targets->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'No active target roles found. Activate at least one target role before running extractions.',
                'active_sources' => $sources->count(),
                'active_targets' => 0,
                'planned_runs' => 0,
            ], 422);
        }

        $preflight = $sources->map(function (ScrapingSource $source): array {
            $support = $source->supportMetadata();

            return [
                'id' => $source->id,
                'name' => $source->name,
                'endpoint' => $source->endpoint,
                'method' => $source->method ?? 'GET',
                'type' => $source->type,
                'headers' => $source->headers ?? [],
                'params' => $source->params ?? [],
                'mode' => $source->mode ?? 'static',
                'pattern' => $source->pattern,
                'adapter_name' => $support['adapter_name'] ?? $source->adapterName(),
                'adapter_mode' => $support['adapter_mode'] ?? 'adapter_missing',
                'support_status' => $support['support_status'] ?? 'unknown',
                'requires_credentials' => (bool) ($support['requires_credentials'] ?? false),
                'requires_proxy' => (bool) ($support['requires_proxy'] ?? false),
                'is_runnable' => (bool) ($support['is_runnable'] ?? false),
                'skip_reason' => (bool) ($support['is_runnable'] ?? false)
                    ? null
                    : ($support['recommended_action'] ?? 'Source is not runnable with the current adapter/configuration.'),
                'recommended_action' => $support['recommended_action'] ?? null,
            ];
        });

        $sourcePayloads = $preflight
            ->filter(fn (array $source): bool => (bool) ($source['is_runnable'] ?? false))
            ->values();
        $skippedSources = $preflight
            ->reject(fn (array $source): bool => (bool) ($source['is_runnable'] ?? false))
            ->values();

        if ($sourcePayloads->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'No runnable scraping sources are configured. Review skipped_sources for credentials or adapter actions.',
                'active_sources' => $sources->count(),
                'runnable_sources' => 0,
                'skipped_sources_count' => $skippedSources->count(),
                'active_targets' => $targets->count(),
                'planned_runs' => 0,
                'skipped_sources' => $skippedSources,
            ], 422);
        }

        $jobs = [];
        foreach ($targets as $target) {
            $query = $target->search_query ?: $target->name;

            foreach ($sourcePayloads as $sourcePayload) {
                $jobs[] = new ProcessMarketScrapingCategory(
                    category: $query,
                    maxResultsPerCategory: 30,
                    sources: [$sourcePayload],
                    runType: 'manual',
                );
            }
        }

        $batch = Bus::batch($jobs)
            ->name('manual-market-scraping:' . now()->toDateTimeString())
            ->onQueue('scraping')
            ->allowFailures()
            ->then(function (Batch $batch): void {
                Log::info('Manual market scraping batch completed', [
                    'batch_id' => $batch->id,
                    'total_jobs' => $batch->totalJobs,
                    'failed_jobs' => $batch->failedJobs,
                ]);
            })
            ->catch(function (Batch $batch, Throwable $e): void {
                Log::error('Manual market scraping batch encountered an unexpected queue error', [
                    'batch_id' => $batch->id,
                    'error' => $e->getMessage(),
                ]);
            })
            ->dispatch();

        return response()->json([
            'success' => true,
            'message' => $skippedSources->isEmpty()
                ? 'Manual extraction run dispatched for all runnable active sources and targets.'
                : 'Manual extraction run dispatched. Some active sources were skipped because they need credentials or adapter work.',
            'batch_id' => $batch->id,
            'active_sources' => $sources->count(),
            'runnable_sources' => $sourcePayloads->count(),
            'skipped_sources_count' => $skippedSources->count(),
            'active_targets' => $targets->count(),
            'planned_runs' => count($jobs),
            'sources' => $sourcePayloads->pluck('name')->values(),
            'skipped_sources' => $skippedSources,
            'targets' => $targets->map(fn (TargetJobRole $target): string => $target->search_query ?: $target->name)->values(),
        ]);
    }
}
