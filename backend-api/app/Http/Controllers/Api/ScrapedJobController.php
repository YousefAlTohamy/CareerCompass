<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreScrapedJobRequest;
use App\Models\Job;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ScrapedJobController extends Controller
{
    /**
     * Import a scraped job from the Python scraper.
     */
    public function import(StoreScrapedJobRequest $request): JsonResponse
    {
        try {
            $validated = $request->validated();

            // Use updateOrCreate to avoid duplicates based on the URL or title/company
            // Since url is unique in the DB, we can use it as the unique identifier if it exists
            $uniqueAttributes = [];
            
            if (!empty($validated['url'])) {
                $uniqueAttributes['url'] = $validated['url'];
            } else {
                $uniqueAttributes['title'] = $validated['title'];
                $uniqueAttributes['company'] = $validated['company'];
            }

            $job = Job::updateOrCreate(
                $uniqueAttributes,
                $validated
            );

            return response()->json([
                'message' => 'Job imported successfully',
                'job_id' => $job->id,
            ], 201);
            
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
    public function checkExistence(Request $request): JsonResponse
    {
        $url = $request->input('url');
        if (!$url) {
            return response()->json(['exists' => false], 400);
        }

        $exists = Job::where('url', $url)->exists();

        return response()->json([
            'exists' => $exists
        ]);
    }

    /**
     * Report a failed scraping URL to the Dead Letter Queue.
     */
    public function reportFailure(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'url' => 'required|url|max:255',
                'scraping_source_id' => 'nullable|exists:scraping_sources,id',
                'error_message' => 'nullable|string',
                'failed_at' => 'nullable|date',
            ]);

            // Add fallback for failed_at
            if (empty($validated['failed_at'])) {
                $validated['failed_at'] = now();
            }

            \App\Models\ScrapingFailedUrl::create($validated);

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
