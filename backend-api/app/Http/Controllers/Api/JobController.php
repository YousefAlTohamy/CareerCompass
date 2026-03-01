<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\JobResource;
use App\Jobs\ProcessOnDemandJobScraping;
use App\Models\Job;
use App\Models\ScrapingJob;
use App\Models\Skill;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class JobController extends Controller
{
    /**
     * Get all jobs (paginated and filterable).
     */
    public function index(Request $request): JsonResponse
    {
        $query = Job::with('skills');

        // Filter by search term (SQL injection safe)
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                // Using parameter binding to prevent SQL injection
                $q->where('title', 'like', '%' . addslashes($search) . '%')
                    ->orWhere('company', 'like', '%' . addslashes($search) . '%')
                    ->orWhere('description', 'like', '%' . addslashes($search) . '%');
            });
        }

        // Filter by source
        if ($request->has('source')) {
            $query->where('source', $request->source);
        }

        // Pagination
        $perPage = $request->get('per_page', 15);
        $jobs = $query->latest()->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => JobResource::collection($jobs),
            'meta' => [
                'current_page' => $jobs->currentPage(),
                'last_page' => $jobs->lastPage(),
                'per_page' => $jobs->perPage(),
                'total' => $jobs->total(),
            ],
        ]);
    }

    /**
     * Get a single job with its skills.
     */
    public function show(int $id): JsonResponse
    {
        $job = Job::with('skills')->find($id);

        if (!$job) {
            return response()->json([
                'success' => false,
                'message' => 'Job not found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => new JobResource($job),
        ]);
    }

    /**
     * Get top 10 jobs recommended for the authenticated user
     * based on their saved job_title (set during CV upload).
     */
    public function getRecommended(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            $jobTitle = $user->job_title;

            if ($jobTitle) {
                // Strip seniority prefix to broaden the search
                // e.g. "Senior Backend Developer" → "Backend Developer"
                $cleanTitle = preg_replace(
                    '/^(senior|junior|lead|principal|associate|mid[- ]?level)\s+/i',
                    '',
                    trim($jobTitle)
                );

                // Extract the first 2 words as a broad keyword
                $words   = explode(' ', $cleanTitle);
                $keyword = implode(' ', array_slice($words, 0, 2));

                $jobs = Job::with('skills')
                    ->where(function ($q) use ($keyword, $cleanTitle) {
                        $q->where('title', 'LIKE', '%' . $keyword . '%')
                            ->orWhere('title', 'LIKE', '%' . $cleanTitle . '%');
                    })
                    ->latest()
                    ->take(50)
                    ->get();

                Log::info('Recommended jobs fetched for user', [
                    'user_id'  => $user->id,
                    'keyword'  => $keyword,
                    'count'    => $jobs->count(),
                ]);
            } else {
                // No job_title yet — return latest 50 jobs as default
                $jobs = Job::with('skills')->latest()->take(50)->get();

                Log::info('No job_title for user, returning latest jobs', [
                    'user_id' => $user->id,
                ]);
            }

            return response()->json([
                'success'   => true,
                'job_title' => $jobTitle,
                'data'      => JobResource::collection($jobs),
                'meta'      => [
                    'total'     => $jobs->count(),
                    'based_on'  => $jobTitle ? "Your CV title: \"{$jobTitle}\"" : 'Latest jobs (upload your CV for personalized results)',
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to fetch recommended jobs', [
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch recommended jobs',
                'error'   => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * Trigger job scraping via AI Engine and store results.
     */
    public function scrapeAndStore(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'query' => 'required|string|max:255',
            'max_results' => 'nullable|integer|min:1|max:50',
            'use_samples' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $query = $request->input('query');
            $maxResults = $request->input('max_results', 50);
            $useSamples = $request->input('use_samples', false);

            Log::info('Initiating job scraping', [
                'query' => $query,
                'max_results' => $maxResults,
                'use_samples' => $useSamples,
                'user_id' => auth()->id(),
            ]);

            // Call AI Engine to scrape jobs
            $aiResponse = $this->scrapeJobsFromAI($query, $maxResults, $useSamples);

            if (!$aiResponse || !isset($aiResponse['jobs'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to scrape jobs from AI Engine',
                ], 500);
            }

            $scrapedJobs = $aiResponse['jobs'];
            $storedCount = 0;
            $duplicateCount = 0;

            // Store each job
            foreach ($scrapedJobs as $jobData) {
                $result = $this->storeJob($jobData);
                if ($result['stored']) {
                    $storedCount++;
                } else {
                    $duplicateCount++;
                }
            }

            Log::info('Job scraping completed', [
                'total_scraped' => count($scrapedJobs),
                'stored' => $storedCount,
                'duplicates' => $duplicateCount,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Jobs scraped and stored successfully',
                'data' => [
                    'total_scraped' => count($scrapedJobs),
                    'stored' => $storedCount,
                    'duplicates_skipped' => $duplicateCount,
                    'query' => $query,
                    'source' => $aiResponse['source'] ?? 'unknown',
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Job scraping failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An error occurred while scraping jobs',
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * Call AI Engine to scrape jobs.
     */
    private function scrapeJobsFromAI(string $query, int $maxResults, bool $useSamples): ?array
    {
        try {
            $aiEngineUrl = config('services.ai_engine.url', 'http://127.0.0.1:8001');
            $timeout = config('services.ai_engine.timeout', 30);

            $response = Http::timeout($timeout)->post("{$aiEngineUrl}/scrape-jobs", [
                'query' => $query,
                'max_results' => $maxResults,
                'use_samples' => $useSamples,
            ]);

            if ($response->successful()) {
                return $response->json();
            }

            Log::error('AI Engine scraping failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return null;
        } catch (\Exception $e) {
            Log::error('Failed to connect to AI Engine for scraping', [
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Store a single job with its skills.
     *
     * @return array ['stored' => bool, 'job' => Job|null]
     */
    private function storeJob(array $jobData): array
    {
        // Normalize URL to prevent duplicates from tracking parameters
        $normalizedUrl = null;
        if (isset($jobData['url']) && $jobData['url']) {
            $normalizedUrl = $this->normalizeUrl($jobData['url']);
        }

        // Check for duplicate (by normalized URL or title+company)
        $existingJob = null;

        if ($normalizedUrl) {
            $existingJob = Job::where('url', $normalizedUrl)->first();
        }

        if (!$existingJob) {
            $existingJob = Job::where('title', $jobData['title'])
                ->where('company', $jobData['company'])
                ->first();
        }

        if ($existingJob) {
            Log::info('Duplicate job found, skipping', [
                'title' => $jobData['title'],
                'company' => $jobData['company'],
            ]);
            return ['stored' => false, 'job' => $existingJob];
        }

        // Create new job with race condition protection
        try {
            $job = Job::create([
                'title' => $jobData['title'],
                'company' => $jobData['company'],
                'description' => $jobData['description'] ?? '',
                'url' => $normalizedUrl ?? $jobData['url'] ?? null,
                'source' => $jobData['source'] ?? 'unknown',
            ]);
        } catch (\Illuminate\Database\QueryException $e) {
            // Handle duplicate entry error (race condition)
            if ($e->getCode() == 23000 || str_contains($e->getMessage(), 'Duplicate entry')) {
                Log::info('Duplicate job prevented by database constraint (race condition)', [
                    'title' => $jobData['title'],
                    'company' => $jobData['company'],
                    'error_code' => $e->getCode(),
                ]);

                // Fetch the existing job that was just created
                $existingJob = Job::where('url', $normalizedUrl ?? $jobData['url'])
                    ->orWhere(function ($q) use ($jobData) {
                        $q->where('title', $jobData['title'])
                            ->where('company', $jobData['company']);
                    })
                    ->first();

                return ['stored' => false, 'job' => $existingJob];
            }

            // Re-throw if it's a different database error
            throw $e;
        }

        // Attach skills
        if (isset($jobData['skills']) && is_array($jobData['skills'])) {
            $skillNames = collect($jobData['skills'])->pluck('name')->toArray();
            $skills = Skill::whereIn('name', $skillNames)->get();

            if ($skills->isNotEmpty()) {
                $job->skills()->sync($skills->pluck('id'));
            }
        }

        Log::info('New job stored', [
            'job_id' => $job->id,
            'title' => $job->title,
            'skills_count' => $job->skills()->count(),
        ]);

        return ['stored' => true, 'job' => $job];
    }

    /**
     * Normalize URL by removing query parameters and fragments.
     * Prevents duplicates from tracking parameters (e.g., utm_source).
     *
     * @param string $url
     * @return string|null
     */
    private function normalizeUrl(string $url): ?string
    {
        if (empty($url)) {
            return null;
        }

        // Parse URL and rebuild without query string and fragment
        $parsed = parse_url($url);

        if (!$parsed || !isset($parsed['host'])) {
            return $url; // Return as-is if parsing fails
        }

        $normalized = '';

        // Rebuild URL: scheme://host/path
        if (isset($parsed['scheme'])) {
            $normalized .= $parsed['scheme'] . '://';
        }

        if (isset($parsed['host'])) {
            $normalized .= $parsed['host'];
        }

        if (isset($parsed['path'])) {
            $normalized .= $parsed['path'];
        }

        // Ignore query (?...) and fragment (#...)

        return $normalized;
    }

    /**
     * Check if job title exists and scrape if missing (on-demand).
     */
    public function scrapeJobTitleIfMissing(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'job_title' => 'required|string|max:255',
            'max_results' => 'nullable|integer|min:1|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $jobTitle = $request->input('job_title');
            $maxResults = $request->input('max_results', 30);

            Log::info('Checking if job title exists', ['job_title' => $jobTitle]);

            // Check if we have jobs for this title
            $existingJobs = Job::where('title', 'like', "%{$jobTitle}%")
                ->with('skills')
                ->count();

            if ($existingJobs > 0) {
                Log::info('Job title exists in database', [
                    'job_title' => $jobTitle,
                    'count' => $existingJobs,
                ]);

                return response()->json([
                    'success' => true,
                    'data_exists' => true,
                    'message' => 'Job data already available',
                    'jobs_count' => $existingJobs,
                ]);
            }

            // Job title doesn't exist - trigger on-demand scraping
            Log::info('Job title not found, triggering on-demand scraping', [
                'job_title' => $jobTitle,
            ]);

            // Create scraping job tracking record
            $scrapingJob = ScrapingJob::create([
                'job_title' => $jobTitle,
                'type' => 'on_demand',
                'status' => 'pending',
            ]);

            // Dispatch to high-priority queue
            ProcessOnDemandJobScraping::dispatch($jobTitle, $scrapingJob->id, $maxResults);

            return response()->json([
                'success' => true,
                'data_exists' => false,
                'message' => 'Analyzing market data for this role. Please wait...',
                'scraping_job_id' => $scrapingJob->id,
                'status' => 'pending',
                'poll_url' => route('api.scraping.status', ['jobId' => $scrapingJob->id]),
            ], 202);
        } catch (\Exception $e) {
            Log::error('Error checking/scraping job title', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An error occurred while processing your request',
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * Check the status of a scraping job.
     */
    public function checkScrapingStatus(int $jobId): JsonResponse
    {
        try {
            $scrapingJob = ScrapingJob::find($jobId);

            if (!$scrapingJob) {
                return response()->json([
                    'success' => false,
                    'message' => 'Scraping job not found',
                ], 404);
            }

            $response = [
                'success' => true,
                'scraping_job_id' => $scrapingJob->id,
                'job_title' => $scrapingJob->job_title,
                'status' => $scrapingJob->status,
                'type' => $scrapingJob->type,
                'started_at' => $scrapingJob->started_at,
            ];

            // Add results if completed
            if ($scrapingJob->status === 'completed') {
                $response['results'] = [
                    'jobs_found' => $scrapingJob->jobs_found,
                    'jobs_stored' => $scrapingJob->jobs_stored,
                    'jobs_duplicated' => $scrapingJob->jobs_duplicated,
                    'completed_at' => $scrapingJob->completed_at,
                ];

                // Get actual jobs
                $jobs = Job::where('title', 'like', "%{$scrapingJob->job_title}%")
                    ->with('skills')
                    ->latest()
                    ->take(50)
                    ->get();

                $response['jobs'] = JobResource::collection($jobs);
            }

            // Add error if failed
            if ($scrapingJob->status === 'failed') {
                $response['error_message'] = $scrapingJob->error_message;
            }

            return response()->json($response);
        } catch (\Exception $e) {
            Log::error('Error checking scraping status', [
                'job_id' => $jobId,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An error occurred while checking status',
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }
}
