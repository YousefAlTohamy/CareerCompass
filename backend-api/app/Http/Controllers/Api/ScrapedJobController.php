<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CheckScrapedJobRequest;
use App\Http\Requests\ReportScrapingFailureRequest;
use App\Http\Requests\StoreScrapedJobRequest;
use App\Models\Job;
use App\Models\ScrapingFailedUrl;
use App\Services\SkillSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ScrapedJobController extends Controller
{
    public function __construct(private readonly SkillSyncService $skillSyncService)
    {
    }

    /**
     * Import a scraped job from the Python scraper.
     */
    public function import(StoreScrapedJobRequest $request): JsonResponse
    {
        try {
            $validated = $request->validated();

            $job = DB::transaction(function () use ($validated): Job {
                $job = null;

                if (!empty($validated['url'])) {
                    $job = Job::where('url', $validated['url'])->first();
                }

                if (!$job) {
                    $titleCandidates = collect([
                        $validated['title'],
                        Str::of($validated['title'])->squish()->title()->toString(),
                    ])->filter()->unique()->values()->all();

                    $job = Job::whereIn('title', $titleCandidates)
                        ->where('company', $validated['company'])
                        ->first();
                }

                if ($job) {
                    $job->fill($validated);
                    $job->save();
                } else {
                    $job = Job::create($validated);
                }

                $this->skillSyncService->syncJobSkills(
                    job: $job,
                    skills: $validated['skills'] ?? [],
                    detaching: false
                );

                return $job->load('skills');
            });

            // Increment Cache count if source_id is provided
            if (!empty($validated['scraping_source_id'])) {
                $sourceId = $validated['scraping_source_id'];
                $status = \Illuminate\Support\Facades\Cache::get("scraping_source_{$sourceId}_status");
                if ($status && isset($status['is_scraping']) && $status['is_scraping']) {
                    if ($job->wasRecentlyCreated) {
                        $status['count'] = ($status['count'] ?? 0) + 1;
                        \Illuminate\Support\Facades\Cache::put("scraping_source_{$sourceId}_status", $status, now()->addHours(2));
                    }
                }
            }

            return response()->json([
                'message' => 'Job imported successfully',
                'job_id' => $job->id,
                'created' => $job->wasRecentlyCreated,
            ], $job->wasRecentlyCreated ? 201 : 200);
            
        } catch (\Exception $e) {
            Log::error('Failed to import scraped job', [
                'error' => $e->getMessage(),
                'payload' => $request->all(),
            ]);

            return response()->json([
                'message' => 'Failed to import job',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Check if a job URL already exists.
     * Uses exists() for fast deduplication check.
     */
    public function checkExistence(CheckScrapedJobRequest $request): JsonResponse
    {
        $exists = Job::where('url', $request->validated('url'))->exists();

        return response()->json([
            'exists' => $exists
        ]);
    }

    /**
     * Report a failed scraping URL to the Dead Letter Queue.
     */
    public function reportFailure(ReportScrapingFailureRequest $request): JsonResponse
    {
        try {
            $validated = $request->validated();

            if (empty($validated['failed_at'])) {
                $validated['failed_at'] = now();
            }

            ScrapingFailedUrl::create($validated);

            return response()->json(['message' => 'Failure reported successfully'], 201);
        } catch (\Exception $e) {
            Log::error('Failed to report scraping failure', [
                'error' => $e->getMessage(),
                'payload' => $request->all(),
            ]);

            return response()->json([
                'message' => 'Failed to report',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
