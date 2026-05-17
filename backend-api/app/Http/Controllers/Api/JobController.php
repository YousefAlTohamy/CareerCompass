<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\JobIndexRequest;
use App\Http\Requests\ScrapeJobTitleIfMissingRequest;
use App\Http\Requests\ScrapeJobsRequest;
use App\Http\Resources\JobResource;
use App\Jobs\ProcessOnDemandJobScraping;
use App\Models\Job;
use App\Models\ScrapingJob;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class JobController extends Controller
{
    /**
     * Get all jobs (paginated and filterable).
     */
    public function index(JobIndexRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $query = $this->publicUsableJobsQuery();

        if (!empty($validated['search'] ?? null)) {
            $search = $validated['search'];
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', '%' . $search . '%')
                    ->orWhere('company', 'like', '%' . $search . '%')
                    ->orWhere('description', 'like', '%' . $search . '%');
            });
        }

        if (!empty($validated['source'] ?? null)) {
            $query->where('source', $validated['source']);
        }

        $perPage = (int) ($validated['per_page'] ?? 15);
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
        $job = Job::with(['requiredSkills', 'scrapingSource'])->find($id);

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
     * Get top 100 jobs recommended for the authenticated user
     * using Native PHP matching algorithm (Phase 3 Integration).
     */
    public function getRecommended(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            $user->loadMissing(['cvAnalysis', 'skills']);
            
            $cvAnalysis = $user->cvAnalysis;
            // Primary: use predicted_role from CV analysis, fallback to user->job_title
            $baseTitle = $cvAnalysis?->predicted_role ?? $user->job_title;
            // Tertiary: extract seniority from CV analysis
            $userSeniority = strtolower($cvAnalysis?->seniority ?? '');

            if ($baseTitle) {
                // Strip seniority prefix to broaden the search
                $cleanTitle = preg_replace(
                    '/^(senior|junior|lead|principal|associate|mid[- ]?level)\s+/i',
                    '',
                    trim($baseTitle)
                );

                // Extract the first 2 words as a broad keyword
                $words   = explode(' ', $cleanTitle);
                $keyword = implode(' ', array_slice($words, 0, 2));

                // Eager load skills to prevent N+1 during matching
                $jobs = $this->publicUsableJobsQuery()
                    ->where(function ($q) use ($keyword, $cleanTitle) {
                        $q->where('title', 'LIKE', '%' . $keyword . '%')
                            ->orWhere('title', 'LIKE', '%' . $cleanTitle . '%');
                    })
                    ->latest()
                    ->take(200) // Fetch up to 200 jobs locally for ranking
                    ->get();

                // ── Ranking Logic ──
                $userSkillsLower = $user->skills->pluck('name')->map(fn($s) => mb_strtolower($s))->toArray();
                
                $jobs->each(function ($job) use ($cleanTitle, $userSkillsLower, $userSeniority) {
                    $score = 0;
                    $jobTitleLower = mb_strtolower($job->title);

                    // 1. Primary: Match predicted_role with job title (Max 30)
                    if (str_contains($jobTitleLower, mb_strtolower($cleanTitle))) {
                        $score += 30;
                    } elseif ($cleanTitle && similar_text($jobTitleLower, mb_strtolower($cleanTitle)) > 60) {
                        $score += 15;
                    }

                    // 2. Secondary: Skill Match Score (Max 50)
                    $jobSkills = $job->requiredSkills;
                    if ($jobSkills->isNotEmpty() && !empty($userSkillsLower)) {
                        $jobSkillNamesLower = $jobSkills->pluck('name')->map(fn($s) => mb_strtolower($s))->toArray();
                        $matchingSkillsCount = count(array_intersect($userSkillsLower, $jobSkillNamesLower));
                        $skillPercentage = ($matchingSkillsCount / $jobSkills->count()); // 0.0 to 1.0
                        $score += ($skillPercentage * 50);
                    } elseif ($jobSkills->isEmpty()) {
                        // Inherit average score if job requires no specific skills
                        $score += 25; 
                    }

                    // 3. Tertiary: Seniority match (Max 20)
                    if ($userSeniority) {
                        if (str_contains($jobTitleLower, $userSeniority)) {
                            $score += 20;
                        } elseif ($userSeniority === 'mid' && (!str_contains($jobTitleLower, 'senior') && !str_contains($jobTitleLower, 'junior') && !str_contains($jobTitleLower, 'lead'))) {
                            $score += 20; // Implicit mid-level match
                        }
                    } else {
                        // Boost slightly if neither is set deeply
                        $score += 10;
                    }

                    $job->match_percentage = round(min(100, $score), 1);
                });

                // Sort by descending match_percentage, then return top 50
                $jobs = $jobs->sortByDesc('match_percentage')->take(50)->values();

                Log::info('Recommended jobs fetched for user', [
                    'user_id'  => $user->id,
                    'keyword'  => $keyword,
                    'count'    => $jobs->count(),
                ]);
            } else {
                // No job_title or CV analysis yet — return latest 50 jobs as default
                $jobs = $this->publicUsableJobsQuery()->latest()->take(50)->get();

                Log::info('No job_title for user, returning latest jobs', [
                    'user_id' => $user->id,
                ]);
            }

            return response()->json([
                'success'   => true,
                'job_title' => $baseTitle,
                'data'      => JobResource::collection($jobs),
                'meta'      => [
                    'total'     => $jobs->count(),
                    'based_on'  => $baseTitle ? "Your CV title: \"{$baseTitle}\"" : 'Latest jobs (upload your CV for personalized results)',
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
     * Trigger job scraping via Scrapy and return immediately.
     */
    public function scrapeAndStore(ScrapeJobsRequest $request): JsonResponse
    {
        try {
            $validated = $request->validated();
            $query = $validated['query'];
            $maxResults = (int) ($validated['max_results'] ?? 50);

            Log::info('Initiating job scraping via Scrapy', [
                'query' => $query,
                'max_results' => $maxResults,
                'user_id' => auth()->id(),
            ]);

            // Create scraping job tracking record
            $scrapingJob = ScrapingJob::create([
                'job_title' => $query,
                'type' => 'on_demand',
                'status' => 'pending',
            ]);

            // Dispatch to high-priority queue
            ProcessOnDemandJobScraping::dispatch($query, $scrapingJob->id, $maxResults);

            return response()->json([
                'success' => true,
                'message' => 'Jobs scraping dispatched to background process',
                'data' => [
                    'query' => $query,
                    'scraping_job_id' => $scrapingJob->id,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Job scraping dispatch failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An error occurred while initiating scraping',
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }



    /**
     * Check if job title exists and scrape if missing (on-demand).
     */
    public function scrapeJobTitleIfMissing(ScrapeJobTitleIfMissingRequest $request): JsonResponse
    {
        try {
            $validated = $request->validated();
            $jobTitle = $validated['job_title'];
            $maxResults = (int) ($validated['max_results'] ?? 30);

            Log::info('Checking if job title exists', ['job_title' => $jobTitle]);

            // Check if we have jobs for this title
            $existingJobs = Job::where('title', 'like', "%{$jobTitle}%")
                ->with('requiredSkills')
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
                'poll_url' => route($request->is('api/v1/*') ? 'api.v1.scraping.status' : 'api.scraping.status', ['jobId' => $scrapingJob->id]),
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
                    'discovered_count' => $scrapingJob->discovered_count,
                    'failed_count' => $scrapingJob->failed_count,
                    'processing_time_ms' => $scrapingJob->processing_time_ms,
                    'completed_at' => $scrapingJob->completed_at,
                ];

                // Get actual jobs
                $jobs = $this->publicUsableJobsQuery()
                    ->where('title', 'like', "%{$scrapingJob->job_title}%")
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

    private function publicUsableJobsQuery()
    {
        return Job::with(['requiredSkills', 'scrapingSource'])
            ->whereNotNull('title')
            ->where('title', '<>', '')
            ->whereNotNull('company')
            ->where('company', '<>', '')
            ->whereNotNull('description')
            ->where('description', '<>', '')
            ->whereNotNull('url')
            ->where('url', 'like', 'http%');
    }
}
