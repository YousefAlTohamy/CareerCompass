<?php

declare(strict_types=1);

namespace App\Services;

use App\Jobs\ProcessOnDemandJobScraping;
use App\Models\CvAnalysis;
use App\Models\ScrapingJob;
use App\Models\Skill;
use App\Models\TargetJobRole;
use App\Models\User;
use App\Models\UserExperience;
use App\Services\Contracts\CvProcessingServiceInterface;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

class CvProcessingService implements CvProcessingServiceInterface
{
    private string $gatewayUrl;
    private int $timeout;

    public function __construct()
    {
        $this->gatewayUrl = rtrim(config('services.ai_cv_analyzer.url', 'http://127.0.0.1:8002'), '/');
        $this->timeout    = (int) config('services.ai_cv_analyzer.timeout', 120);
    }

    /**
     * Process the uploaded CV via V3 AI Gateway and persist to the normalized schema.
     *
     * @param UploadedFile $file
     * @param User $user
     * @return array{aiData: array<string, mixed>, syncedSkills: Collection<int, Skill>|array, isNewRole: bool, domain: string|null}
     *
     * @throws \Illuminate\Http\Client\ConnectionException
     * @throws \RuntimeException
     * @throws \Exception
     */
    public function processCv(UploadedFile $file, User $user): array
    {
        // ── Step 1: Call V3 AI Gateway ─────────────────────────────────────
        $v3Response = $this->callV3Gateway($file);

        // Validate parsing status — reject empty/unparseable CVs
        $parsingStatus = $v3Response['parsing_status'] ?? 'success';
        if ($parsingStatus === 'empty_file' || $parsingStatus === 'no_text' || $parsingStatus === 'error') {
            throw new RuntimeException(
                "Could not extract text from the CV (status={$parsingStatus}). Please ensure the file contains readable content."
            );
        }

        // ── Step 2: Persist all data within a single DB transaction ─────────
        $syncedSkills = new Collection();
        DB::transaction(function () use ($user, $v3Response, &$syncedSkills): void {
            $this->persistUserProfile($user, $v3Response);
            $this->persistUserExperiences($user, $v3Response);
            $syncedSkills = $this->persistUserSkills($user, $v3Response);
            $this->persistCvAnalysis($user, $v3Response);
        });

        // ── Step 3: Self-expanding role discovery ───────────────────────────
        $domain    = $v3Response['analysis']['primary_domain'] ?? null;
        $isNewRole = false;
        if ($domain !== null && $domain !== '') {
            $isNewRole = $this->discoverNewRole((string) $domain);
        }

        // Build aiData for backward-compatible controller response
        $aiData = $this->buildAiDataForResponse($v3Response);

        return [
            'aiData'       => $aiData,
            'syncedSkills' => $syncedSkills,
            'isNewRole'    => $isNewRole,
            'domain'       => $domain,
        ];
    }

    /**
     * Call the V3 Python AI CV Parser endpoint (/api/v3/analyze-cv).
     * Expects CVParseResult JSON schema: profile, stats, skills, experience, analysis.
     *
     * Note: V3 is served by ai-cv-analyzer (typically port 8002). Set AI_GATEWAY_URL
     * in .env to point at that service when using this integration.
     *
     * @param UploadedFile $file
     * @return array<string, mixed> Raw V3 API response
     *
     * @throws \Illuminate\Http\Client\ConnectionException
     * @throws \RuntimeException
     */
    private function callV3Gateway(UploadedFile $file): array
    {
        $fileName = $file->getClientOriginalName();
        $url      = "{$this->gatewayUrl}/api/v3/analyze-cv";

        Log::info('Sending CV to V3 AI Gateway', [
            'url'       => $url,
            'file_name' => $fileName,
            'file_size' => $file->getSize(),
        ]);

        try {
            $response = Http::timeout($this->timeout)
                ->attach(
                    'file',
                    fopen($file->getPathname(), 'r'),
                    (string) $fileName
                )
                ->post($url);

            if ($response->failed()) {
                Log::error('V3 AI Gateway returned an error', [
                    'status' => $response->status(),
                    'body'   => Str::limit($response->body(), 500),
                ]);

                throw new RuntimeException(
                    "AI Gateway error [{$response->status()}]: " . Str::limit($response->body(), 200)
                );
            }

            $data = $response->json();
            if (!is_array($data)) {
                throw new RuntimeException('AI Gateway returned invalid JSON.');
            }

            Log::info('V3 AI Gateway response received', [
                'parsing_status' => $data['parsing_status'] ?? null,
                'primary_domain' => $data['analysis']['primary_domain'] ?? null,
                'skills_count'   => isset($data['skills']['items']) ? count($data['skills']['items']) : 0,
                'experience_count' => isset($data['experience']['items']) ? count($data['experience']['items']) : 0,
            ]);

            return $data;
        } catch (RuntimeException $e) {
            throw $e;
        } catch (\Throwable $e) {
            Log::error('V3 AI Gateway request failed', [
                'url'   => $url,
                'error' => $e->getMessage(),
            ]);
            throw new RuntimeException('Failed to communicate with the AI CV parser.', 0, $e);
        }
    }

    /**
     * Persist UserProfile from V3 profile, stats, and analysis sections.
     * Maps: headline<-current_title, summary, location, total_experience_years, seniority, primary_domain, contact_info.
     */
    private function persistUserProfile(User $user, array $v3Response): void
    {
        $profileData = $v3Response['profile'] ?? [];
        $analysis    = $v3Response['analysis'] ?? [];

        $contact = $profileData['contact'] ?? [];
        $contact = is_array($contact) ? $contact : [];

        // total_experience_years: prefer analysis.metadata.experience
        $totalExperienceYears = null;
        $expMeta = $analysis['metadata']['experience'] ?? null;
        if (is_array($expMeta) && isset($expMeta['total_experience_years'])) {
            $totalExperienceYears = (float) $expMeta['total_experience_years'];
        }

        $profile = $user->profile()->firstOrCreate([], []);

        // Build contact_info JSON: merge existing with API values (API takes precedence when non-empty)
        $existingContact = is_array($profile->contact_info ?? null) ? $profile->contact_info : [];
        $contactInfo = array_filter([
            'email'         => !empty($contact['email']) ? (string) $contact['email'] : ($existingContact['email'] ?? null),
            'phone'         => !empty($contact['phone']) ? (string) $contact['phone'] : ($existingContact['phone'] ?? null),
            'linkedin_url'  => !empty($contact['linkedin_url']) ? (string) $contact['linkedin_url'] : ($existingContact['linkedin_url'] ?? null),
            'github_url'    => !empty($contact['github_url']) ? (string) $contact['github_url'] : ($existingContact['github_url'] ?? null),
            'portfolio_url' => !empty($contact['portfolio_url']) ? (string) $contact['portfolio_url'] : ($existingContact['portfolio_url'] ?? null),
        ], fn($v) => $v !== null && $v !== '');

        $profile->update([
            'headline'               => $profileData['current_title'] ?? $profileData['headline'] ?? $profile->headline,
            'summary'                => $profileData['summary'] ?? $profile->summary,
            'location'               => $contact['location'] ?? $profile->location,
            'total_experience_years' => $totalExperienceYears ?? $profile->total_experience_years,
            'seniority'              => $analysis['seniority'] ?? $profile->seniority,
            'primary_domain'         => $analysis['primary_domain'] ?? $profile->primary_domain,
            'contact_info'           => !empty($contactInfo) ? $contactInfo : $profile->contact_info,
        ]);

        Log::info('User profile updated from V3 CV parse', [
            'user_id'  => $user->id,
            'headline' => $profile->headline,
        ]);
    }

    /**
     * Delete existing user experiences and create new ones from experience.items.
     * Handles date parsing (YYYY-MM-DD) via Carbon and null-safe storage.
     */
    private function persistUserExperiences(User $user, array $v3Response): Collection
    {
        $user->experiences()->delete();

        $items = $v3Response['experience']['items'] ?? [];
        if (!is_array($items)) {
            return new Collection();
        }

        $created = new Collection();
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            $title   = trim((string) ($item['title'] ?? ''));
            $company = trim((string) ($item['company'] ?? ''));
            if ($title === '' && $company === '') {
                continue;
            }

            $startDate  = $this->parseDate($item['start_date'] ?? null);
            $endDate    = $this->parseDate($item['end_date'] ?? null);
            $isCurrent  = (bool) ($item['is_current'] ?? false);
            $descriptions = $item['description'] ?? [];
            $descriptionText = is_array($descriptions)
                ? implode("\n", array_map('strval', $descriptions))
                : (string) $descriptions;

            $exp = UserExperience::create([
                'user_id'     => $user->id,
                'title'       => $title ?: 'Unknown',
                'company'     => $company ?: 'Unknown',
                'location'    => !empty($item['location']) ? (string) $item['location'] : null,
                'start_date'  => $startDate,
                'end_date'    => $endDate,
                'is_current'  => $isCurrent,
                'description' => $descriptionText ?: null,
            ]);

            $created->push($exp);
        }

        Log::info('User experiences persisted from V3 CV', [
            'user_id' => $user->id,
            'count'   => $created->count(),
        ]);

        return $created;
    }

    /**
     * Parse date string (YYYY-MM-DD) to Carbon or null.
     */
    private function parseDate(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        try {
            $date = Carbon::parse((string) $value);
            return $date->format('Y-m-d');
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * FirstOrCreate skills from skills.items, then sync to user with confidence_score and evidence in pivot.
     * Joins sources array into evidence string when evidence is missing.
     */
    private function persistUserSkills(User $user, array $v3Response): Collection
    {
        $items = $v3Response['skills']['items'] ?? [];
        if (!is_array($items) || empty($items)) {
            Log::warning('No skills returned by V3 AI Gateway', ['user_id' => $user->id]);
            $user->skills()->sync([]);
            return new Collection();
        }

        $syncData = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            $name = trim((string) ($item['name'] ?? ''));
            if ($name === '') {
                continue;
            }

            $category = (string) ($item['category'] ?? 'other');
            $type     = $this->mapSkillCategoryToType($category);

            $skill = Skill::firstOrCreate(
                ['name' => $name],
                ['type' => $type]
            );

            $confidenceScore = isset($item['confidence_score'])
                ? (float) $item['confidence_score']
                : null;

            $evidence = $item['evidence'] ?? null;
            if ($evidence === null || $evidence === '') {
                $sources = $item['sources'] ?? [];
                $evidence = is_array($sources) ? implode(', ', array_map('strval', $sources)) : null;
            } else {
                $evidence = (string) $evidence;
            }

            // Pivot: confidence_score and evidence (nullable)
            $syncData[$skill->id] = [
                'confidence_score' => $confidenceScore,
                'evidence'         => $evidence ?: null,
            ];
        }

        $user->skills()->sync($syncData);

        $skills = Skill::whereIn('id', array_keys($syncData))->get();

        Log::info('User skills synced from V3 CV', [
            'user_id'      => $user->id,
            'total_skills' => $skills->count(),
        ]);

        return $skills;
    }

    /**
     * Map V3 skill category to Skill.type (technical | soft).
     */
    private function mapSkillCategoryToType(string $category): string
    {
        return match (strtolower($category)) {
            'soft' => 'soft',
            default => 'technical',
        };
    }

    /**
     * Create or update CvAnalysis record with parsing_status, completeness_score, strengths, gaps, red_flags, raw_json_output.
     */
    private function persistCvAnalysis(User $user, array $v3Response): void
    {
        $analysis = $v3Response['analysis'] ?? [];

        $completenessScore = null;
        if (isset($analysis['confidence_score'])) {
            $completenessScore = (int) round((float) $analysis['confidence_score'] * 100);
        }

        CvAnalysis::updateOrCreate(
            ['user_id' => $user->id],
            [
                'parsing_status'     => (string) ($v3Response['parsing_status'] ?? 'success'),
                'completeness_score' => $completenessScore,
                'strengths'          => $analysis['strengths'] ?? [],
                'gaps'               => $analysis['gaps'] ?? [],
                'red_flags'          => $analysis['red_flags'] ?? [],
                'raw_json_output'    => $v3Response,
            ]
        );

        Log::info('CvAnalysis persisted for user', ['user_id' => $user->id]);
    }

    /**
     * Build backward-compatible aiData for controller response (domain, domain_confidence, extraction_method, etc.).
     */
    private function buildAiDataForResponse(array $v3Response): array
    {
        $analysis = $v3Response['analysis'] ?? [];
        $metadata = $analysis['metadata'] ?? [];

        $extractionMethod = 'v3-orchestrator';
        if (is_array($metadata) && isset($metadata['extraction']['spatial_status'])) {
            $extractionMethod = (string) $metadata['extraction']['spatial_status'];
        }

        return [
            'domain'             => $analysis['primary_domain'] ?? null,
            'domain_confidence'  => isset($analysis['confidence_score'])
                ? round((float) $analysis['confidence_score'] * 100, 1) . '%'
                : 'N/A',
            'extraction_method'  => $extractionMethod,
            'parsing_status'     => $v3Response['parsing_status'] ?? 'success',
            'profile'            => $v3Response['profile'] ?? [],
            'stats'              => $v3Response['stats'] ?? [],
            'skills'             => array_map(fn($s) => is_array($s) ? ($s['name'] ?? '') : (string) $s, $v3Response['skills']['items'] ?? []),
            'experience'         => $v3Response['experience'] ?? [],
            'analysis'           => $analysis,
        ];
    }

    /**
     * Self-expanding role discovery.
     */
    private function discoverNewRole(string $domain): bool
    {
        $exists = TargetJobRole::where('name', 'LIKE', '%' . $domain . '%')
            ->orWhere(function ($q) use ($domain) {
                $q->whereRaw('? LIKE CONCAT(\'%\', name, \'%\')', [$domain]);
            })
            ->exists();

        if ($exists) {
            return false;
        }

        $role = TargetJobRole::create([
            'name'      => $domain,
            'is_active' => true,
        ]);

        Log::info('New target job role auto-discovered and created', [
            'role_id'   => $role->id,
            'role_name' => $domain,
        ]);

        try {
            $scrapingJob = ScrapingJob::create([
                'job_title' => $domain,
                'status'    => 'pending',
                'type'      => 'on_demand',
            ]);

            ProcessOnDemandJobScraping::dispatch($domain, $scrapingJob->id, 30);

            Log::info('Background scraping dispatched for new role', [
                'role'           => $domain,
                'scraping_job_id' => $scrapingJob->id,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to dispatch background scraping for new role', [
                'role'  => $domain,
                'error' => $e->getMessage(),
            ]);
        }

        return true;
    }
}
