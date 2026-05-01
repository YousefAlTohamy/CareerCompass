<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreScrapedJobRequest;
use App\Models\Job;
use Illuminate\Http\JsonResponse;
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
}
