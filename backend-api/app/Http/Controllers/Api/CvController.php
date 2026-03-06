<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CvUploadRequest;
use App\Http\Resources\SkillResource;
use App\Jobs\ProcessOnDemandJobScraping;
use App\Models\ScrapingJob;
use App\Models\Skill;
use App\Models\TargetJobRole;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class CvController extends Controller
{
    // ─────────────────────────────────────────────────────────────────────────
    // Configuration
    // ─────────────────────────────────────────────────────────────────────────

    /** Base URL of the AI Gateway (ai-hybrid-orchestrator / main_api.py) */
    private string $gatewayUrl;

    /** HTTP timeout in seconds */
    private int $timeout;

    public function __construct()
    {
        $this->gatewayUrl = config('services.ai_gateway.url', 'http://127.0.0.1:8001');
        $this->timeout    = (int) config('services.ai_gateway.timeout', 30);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public endpoints
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Upload a CV, send it to the AI Gateway, persist the results,
     * and trigger self-expanding role discovery when needed.
     *
     * POST /api/cv/upload
     */
    public function upload(CvUploadRequest $request): JsonResponse
    {
        // Prevent PHP from killing the script during heavy ML processing (OCR, NER)
        set_time_limit(30);

        $user = $request->user();

        try {
            // ── Step 1: Call AI Gateway ───────────────────────────────────
            $file    = $request->file('cv');
            $aiData  = $this->callGateway($file);

            // ── Step 2: Update user profile & sync skills ──────────────────
            $this->updateUserProfile($user, $aiData);
            $syncedSkills = $this->syncUserSkills($user, $aiData['skills'] ?? []);

            // ── Step 3: Self-expanding role discovery ─────────────────────
            $domain     = $aiData['domain'] ?? null;
            $isNewRole  = false;

            if ($domain) {
                $isNewRole = $this->discoverNewRole($domain);
            }

            // ── Step 4: Return unified response ───────────────────────────
            $user->refresh();

            Log::info('CV parsed and profile updated via AI Gateway', [
                'user_id'    => $user->id,
                'domain'     => $domain,
                'skills'     => count($syncedSkills),
                'is_new_role' => $isNewRole,
            ]);

            return response()->json([
                'success'     => true,
                'message'     => 'CV parsed successfully.',
                'is_new_role' => $isNewRole,
                'user'        => [
                    'id'               => $user->id,
                    'name'             => $user->name,
                    'email'            => $user->email,
                    'job_title'        => $user->job_title,
                    'domain_confidence' => $aiData['domain_confidence'] ?? null,
                    'phone'            => $user->phone,
                    'location'         => $user->location,
                    'linkedin_url'     => $user->linkedin_url,
                    'github_url'       => $user->github_url,
                    'extraction_method' => $aiData['extraction_method'] ?? null,
                ],
                'skills' => SkillResource::collection(
                    $user->skills()->orderBy('name')->get()
                ),
            ]);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            Log::error('AI Gateway unreachable', [
                'user_id' => $user->id,
                'url'     => $this->gatewayUrl,
                'error'   => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'The AI engine is currently unavailable. Please try again in a moment.',
            ], 503);
        } catch (\Exception $e) {
            Log::error('CV upload failed', [
                'user_id' => $user->id,
                'error'   => $e->getMessage(),
                'trace'   => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An error occurred while processing your CV.',
                'error'   => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /**
     * Get the current user's skills.
     *
     * GET /api/cv/skills
     */
    public function getUserSkills(): JsonResponse
    {
        $user   = request()->user();
        $skills = $user->skills;

        return response()->json([
            'success' => true,
            'data'    => [
                'total'    => $skills->count(),
                'technical' => $skills->where('type', 'technical')->count(),
                'soft'     => $skills->where('type', 'soft')->count(),
                'skills'   => SkillResource::collection($skills),
            ],
        ]);
    }

    /**
     * Remove a skill from the user's profile.
     *
     * DELETE /api/cv/skills/{skillId}
     */
    public function removeSkill(int $skillId): JsonResponse
    {
        $user  = request()->user();
        $skill = $user->skills()->find($skillId);

        if (!$skill) {
            return response()->json([
                'success' => false,
                'message' => 'Skill not found in your profile.',
            ], 404);
        }

        $user->skills()->detach($skillId);

        Log::info('Skill removed from user profile', [
            'user_id'    => $user->id,
            'skill_id'   => $skillId,
            'skill_name' => $skill->name,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Skill removed successfully.',
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Send the uploaded CV to the AI Gateway's /parse-cv endpoint.
     *
     * @param  \Illuminate\Http\UploadedFile $file
     * @return array<string, mixed>
     *
     * @throws \Illuminate\Http\Client\ConnectionException  If gateway is unreachable.
     * @throws \RuntimeException                            If gateway returns an error status.
     */
    private function callGateway(\Illuminate\Http\UploadedFile $file): array
    {
        $fileName = $file->getClientOriginalName();

        Log::info('Sending CV to AI Gateway', [
            'url'       => "{$this->gatewayUrl}/api/v1/parse-cv",
            'file_name' => $fileName,
            'file_size' => $file->getSize(),
        ]);

        $response = Http::timeout(30)
            ->attach(
                'cv_file',                      // field name expected by FastAPI
                fopen($file->getPathname(), 'r'), // raw stream (prevents Windows cURL hang)
                $fileName                        // original filename (extension matters for OCR)
            )
            ->post("{$this->gatewayUrl}/api/v1/parse-cv");

        if ($response->failed()) {
            Log::error('AI Gateway returned an error', [
                'status' => $response->status(),
                'body'   => Str::limit($response->body(), 500),
            ]);

            throw new \RuntimeException(
                "AI Gateway error [{$response->status()}]: " . Str::limit($response->body(), 200)
            );
        }

        $data = $response->json();

        Log::info('AI Gateway response received', [
            'domain'            => $data['domain'] ?? null,
            'skills_count'      => count($data['skills'] ?? []),
            'extraction_method' => $data['extraction_method'] ?? null,
        ]);

        return $data;
    }

    /**
     * Update the authenticated user's profile with data from the AI Gateway.
     *
     * Uses null-coalescing fallback so existing values are never overwritten
     * with empty strings.
     *
     * @param  \App\Models\User        $user
     * @param  array<string, mixed>    $aiData
     */
    private function updateUserProfile(\App\Models\User $user, array $aiData): void
    {
        $contact = $aiData['contact_info'] ?? [];

        $user->update([
            // Domain becomes the user's job title (BART-MNLI classification)
            'job_title'    => $aiData['domain']              ?? $user->job_title,
            // Contact fields — only overwrite if the Gateway returned a non-empty value
            'phone'        => ($contact['phone']        ?? '') ?: $user->phone,
            'location'     => ($contact['location']     ?? '') ?: $user->location,
            'linkedin_url' => ($contact['linkedin_url'] ?? '') ?: $user->linkedin_url,
            'github_url'   => ($contact['github_url']   ?? '') ?: $user->github_url,
        ]);

        Log::info('User profile updated from CV parse', [
            'user_id'   => $user->id,
            'job_title' => $user->job_title,
        ]);
    }

    /**
     * Find-or-create skills from the AI response and sync them to the user.
     *
     * The Gateway returns skills as a flat string array: ["Python", "Django", …]
     *
     * @param  \App\Models\User     $user
     * @param  array<int, string>   $rawSkills
     * @return \Illuminate\Database\Eloquent\Collection
     */
    private function syncUserSkills(\App\Models\User $user, array $rawSkills): \Illuminate\Database\Eloquent\Collection
    {
        if (empty($rawSkills)) {
            Log::warning('No skills returned by AI Gateway', ['user_id' => $user->id]);
            return collect();
        }

        // Normalise: Gateway may return plain strings or [{name, type}] dicts
        $normalised = collect($rawSkills)->map(function ($item) {
            if (is_string($item)) {
                return ['name' => trim($item), 'type' => 'technical'];
            }
            return [
                'name' => trim($item['name'] ?? ''),
                'type' => $item['type'] ?? 'technical',
            ];
        })->filter(fn($s) => !empty($s['name']));

        $skillNames = $normalised->pluck('name')->toArray();

        // Re-fetch after creating to get a complete collection
        $existing = Skill::whereIn('name', $skillNames)->pluck('name')->toArray();
        $missing  = $normalised->filter(fn($s) => !in_array($s['name'], $existing));

        foreach ($missing as $skillData) {
            try {
                Skill::firstOrCreate(
                    ['name' => $skillData['name']],
                    ['type' => $skillData['type']]
                );
            } catch (\Exception $e) {
                // Race condition — another request created it simultaneously
                Log::warning('Skill creation skipped (already exists)', [
                    'name'  => $skillData['name'],
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $skills = Skill::whereIn('name', $skillNames)->get();

        // REPLACE (not additive) — this CV upload defines the user's current skill set
        $user->skills()->sync($skills->pluck('id'));

        Log::info('User skills synced', [
            'user_id'       => $user->id,
            'total_skills'  => $skills->count(),
            'new_skills'    => count($missing),
        ]);

        return $skills;
    }

    /**
     * Self-expanding role discovery.
     *
     * If the AI-classified domain does not exist as a TargetJobRole,
     * create it and dispatch background scraping so market data is
     * collected automatically — no manual admin action required.
     *
     * @param  string $domain  Domain string from BART-MNLI (e.g. "Backend Development")
     * @return bool            True if a brand-new role was discovered and dispatched
     */
    private function discoverNewRole(string $domain): bool
    {
        // Fuzzy check: tolerate slight wording differences
        $exists = TargetJobRole::where('name', 'LIKE', '%' . $domain . '%')
            ->orWhere(function ($q) use ($domain) {
                // Also match if existing role name is contained inside the domain string
                $q->whereRaw('? LIKE CONCAT(\'%\', name, \'%\')', [$domain]);
            })
            ->exists();

        if ($exists) {
            return false;
        }

        // Create the new role entry
        $role = TargetJobRole::create([
            'name'      => $domain,
            'is_active' => true,
        ]);

        Log::info('New target job role auto-discovered and created', [
            'role_id'   => $role->id,
            'role_name' => $domain,
        ]);

        // Create a ScrapingJob tracking record, then dispatch to the queue
        try {
            $scrapingJob = ScrapingJob::create([
                'job_title' => $domain,
                'status'    => 'pending',
                'type'      => 'on_demand',
            ]);

            ProcessOnDemandJobScraping::dispatch(
                $domain,
                $scrapingJob->id,
                30           // max results for a new role discovery
            );

            Log::info('Background scraping dispatched for new role', [
                'role'           => $domain,
                'scraping_job_id' => $scrapingJob->id,
            ]);
        } catch (\Exception $e) {
            // Non-fatal: role was created, scraping can be triggered later
            Log::error('Failed to dispatch background scraping for new role', [
                'role'  => $domain,
                'error' => $e->getMessage(),
            ]);
        }

        return true;
    }
}
