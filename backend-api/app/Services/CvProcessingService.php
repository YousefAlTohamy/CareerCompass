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
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use RuntimeException;

class CvProcessingService implements CvProcessingServiceInterface
{
    private string $gatewayUrl;
    private int $timeout;

    public function __construct(
        private readonly SkillSyncService $skillSyncService,
        private readonly CvStorageService $cvStorageService,
    ) {
        $baseUrl = rtrim(config('services.ai_cv_analyzer.url', 'http://127.0.0.1:8002'), '/');
        $this->gatewayUrl = "{$baseUrl}/api/parse-cv";
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
        $v3Response = $this->callV3Gateway($file);

        $parsingStatus = strtolower((string) ($v3Response['parsing_status'] ?? 'success'));

        // Log OCR fallback so we can surface it to the user
        if ($parsingStatus === 'ocr_fallback') {
            Log::info('CV was processed using OCR fallback — text extraction may be less accurate.', [
                'user_id' => $user->id,
            ]);
        }

        $storedCv = $this->cvStorageService->store($file, $user);
        $syncedSkills = new Collection();
        $shouldPersistStructuredData = !in_array($parsingStatus, ['timeout', 'error', 'empty_file', 'no_text'], true);

        try {
            DB::transaction(function () use ($user, $v3Response, $storedCv, $shouldPersistStructuredData, &$syncedSkills): void {
                if ($shouldPersistStructuredData) {
                    $this->persistUserProfile($user, $v3Response);
                    $this->persistUserExperiences($user, $v3Response);
                    $syncedSkills = $this->persistUserSkills($user, $v3Response);
                }

                $this->persistCvAnalysis($user, $v3Response, $storedCv);
            });
        } catch (\Throwable $e) {
            $this->cvStorageService->delete($storedCv['disk'] ?? null, $storedCv['path'] ?? null);
            throw $e;
        }

        if (!$shouldPersistStructuredData) {
            Log::warning('CV parsed with an incomplete status; structured profile data was not refreshed', [
                'user_id' => $user->id,
                'parsing_status' => $parsingStatus,
            ]);
        }

        $analysis = is_array($v3Response['analysis'] ?? null) ? $v3Response['analysis'] : [];
        $domain = $analysis['primary_domain'] ?? null;
        $roleSeed = $this->resolveRoleDiscoverySeed($v3Response);
        $isNewRole = false;
        if ($roleSeed !== null) {
            $isNewRole = $this->discoverNewRole($roleSeed['value']);

            Log::info('Role discovery evaluated from CV analysis', [
                'user_id' => $user->id,
                'role_seed' => $roleSeed['value'],
                'role_seed_source' => $roleSeed['source'],
                'primary_domain' => $domain,
                'is_new_role' => $isNewRole,
            ]);
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
     * Call the V3 Python AI CV Parser endpoint.
     *
     * Handles timeouts and 500 errors gracefully — logs and re-throws
     * as RuntimeException with descriptive messages.
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
        $url      = $this->gatewayUrl;

        Log::info('Sending CV to V3 AI Gateway', [
            'url'       => $url,
            'file_name' => $fileName,
            'file_size' => $file->getSize(),
        ]);

        $handle = fopen($file->getPathname(), 'rb');
        if ($handle === false) {
            throw new RuntimeException('Unable to read uploaded CV.');
        }

        try {
            $response = Http::timeout($this->timeout)
                ->connectTimeout(10)
                ->acceptJson()
                ->withHeaders($this->correlationHeaders())
                ->attach(
                    'file',
                    $handle,
                    (string) $fileName
                )
                ->post($url);

            if ($response->failed()) {
                Log::error('V3 AI Gateway returned an error', [
                    'status' => $response->status(),
                    'body_present' => $response->body() !== '',
                ]);

                throw new RuntimeException('AI Gateway returned an unsuccessful response.');
            }

            $data = $response->json();
            if (!is_array($data)) {
                throw new RuntimeException('AI Gateway returned invalid JSON.');
            }
            $data = $this->normalizeGatewayResponse($data);

            Log::info('V3 AI Gateway response received', [
                'parsing_status'   => $data['parsing_status'] ?? null,
                'seniority'        => $data['analysis']['seniority'] ?? null,
                'predicted_role'   => $data['analysis']['predicted_role'] ?? null,
                'primary_domain'   => $data['analysis']['primary_domain'] ?? null,
                'skills_count'     => isset($data['skills']['items']) ? count($data['skills']['items']) : 0,
                'experience_count' => isset($data['experience']['items']) ? count($data['experience']['items']) : 0,
            ]);

            return $data;
        } catch (RuntimeException $e) {
            throw $e;
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            Log::error('V3 AI Gateway connection timed out or refused', [
                'url'     => $url,
                'timeout' => $this->timeout,
                'error_class' => $e::class,
            ]);
            throw $e;
        } catch (\Throwable $e) {
            Log::error('V3 AI Gateway request failed', [
                'url'   => $url,
                'error_class' => $e::class,
            ]);
            throw new RuntimeException('Failed to communicate with the AI CV parser.', 0, $e);
        } finally {
            if (is_resource($handle)) {
                fclose($handle);
            }
        }
    }

    /**
     * Normalize the AI response so persistence always sees predictable sections.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    private function normalizeGatewayResponse(array $data): array
    {
        $hasExpectedSections = array_key_exists('profile', $data)
            || array_key_exists('analysis', $data)
            || array_key_exists('skills', $data)
            || array_key_exists('experience', $data);

        if (!$hasExpectedSections) {
            return $this->structuredGatewayError('AI response did not include expected CV analysis fields.');
        }

        $knownStatuses = ['success', 'timeout', 'error', 'ocr_fallback', 'empty_file', 'no_text', 'partial_success'];
        $status = strtolower(trim((string) ($data['parsing_status'] ?? 'success')));
        if (!in_array($status, $knownStatuses, true)) {
            return $this->structuredGatewayError('AI response included an unknown parsing status.');
        }

        $data['parsing_status'] = $status;
        $data['profile'] = is_array($data['profile'] ?? null) ? $data['profile'] : [];
        $data['stats'] = is_array($data['stats'] ?? null) ? $data['stats'] : [];
        $data['analysis'] = is_array($data['analysis'] ?? null) ? $data['analysis'] : [];

        if (!is_array($data['skills'] ?? null)) {
            $data['skills'] = [];
        }
        if (!is_array($data['skills']['items'] ?? null)) {
            $data['skills']['items'] = [];
        }

        if (!is_array($data['experience'] ?? null)) {
            $data['experience'] = [];
        }
        if (!is_array($data['experience']['items'] ?? null)) {
            $data['experience']['items'] = [];
        }

        if (!is_array($data['analysis']['metadata'] ?? null)) {
            $data['analysis']['metadata'] = [];
        }

        return $data;
    }

    /**
     * @return array<string, mixed>
     */
    private function structuredGatewayError(string $message): array
    {
        return [
            'parsing_status' => 'error',
            'profile' => [],
            'stats' => [],
            'skills' => ['items' => []],
            'experience' => ['items' => []],
            'analysis' => [
                'metadata' => [
                    'error' => $message,
                ],
            ],
        ];
    }

    // ─────────────────────────────────────────────────────────────────────
    // Persistence Helpers (SRP: each handles one domain model)
    // ─────────────────────────────────────────────────────────────────────

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
     * Phase 2: Now also persists ExperienceItem.technologies as a JSON array.
     */
    private function persistUserExperiences(User $user, array $v3Response): Collection
    {
        $parsingStatus = strtolower((string) ($v3Response['parsing_status'] ?? 'success'));
        if (in_array($parsingStatus, ['timeout', 'error', 'empty_file', 'no_text'], true)) {
            Log::warning('Skipping experience refresh because CV parsing did not complete', [
                'user_id' => $user->id,
                'parsing_status' => $parsingStatus,
            ]);
            return new Collection();
        }

        $items = $v3Response['experience']['items'] ?? [];
        if (!is_array($items) || empty($items)) {
            Log::warning('No experiences returned by V3 AI Gateway; preserving existing user experiences', [
                'user_id' => $user->id,
            ]);
            return new Collection();
        }

        $created = new Collection();
        $validItems = array_values(array_filter($items, function (mixed $item): bool {
            if (!is_array($item)) {
                return false;
            }

            return trim((string) ($item['title'] ?? '')) !== ''
                || trim((string) ($item['company'] ?? '')) !== '';
        }));

        if (empty($validItems)) {
            Log::warning('No valid experiences extracted from V3 AI Gateway response; preserving existing user experiences', [
                'user_id' => $user->id,
                'items_count' => count($items),
            ]);
            return new Collection();
        }

        $user->experiences()->delete();

        foreach ($validItems as $item) {
            $title   = trim((string) ($item['title'] ?? ''));
            $company = trim((string) ($item['company'] ?? ''));

            $startDate  = $this->parseDate($item['start_date'] ?? null);
            $endDate    = $this->parseDate($item['end_date'] ?? null);
            $isCurrent  = (bool) ($item['is_current'] ?? false);
            $descriptions = $item['description'] ?? [];
            $descriptionText = is_array($descriptions)
                ? implode("\n", array_map('strval', $descriptions))
                : (string) $descriptions;

            // Phase 2: Extract and sanitize technologies array
            $technologies = $this->sanitizeTechnologies($item['technologies'] ?? []);

            $exp = UserExperience::create([
                'user_id'      => $user->id,
                'title'        => $title ?: 'Unknown',
                'company'      => $company ?: 'Unknown',
                'location'     => !empty($item['location']) ? (string) $item['location'] : null,
                'start_date'   => $startDate,
                'end_date'     => $endDate,
                'is_current'   => $isCurrent,
                'description'  => $descriptionText ?: null,
                'technologies' => !empty($technologies) ? $technologies : null,
            ]);

            $created->push($exp);
        }

        Log::info('User experiences persisted from V3 CV', [
            'user_id' => $user->id,
            'count'   => $created->count(),
            'with_technologies' => $created->filter(fn($e) => !empty($e->technologies))->count(),
        ]);

        return $created;
    }

    /**
     * Sanitize and validate technologies array from AI response.
     * Filters out non-string values, trims whitespace, removes empties.
     *
     * @param mixed $technologies
     * @return list<string>
     */
    private function sanitizeTechnologies(mixed $technologies): array
    {
        if (!is_array($technologies)) {
            return [];
        }

        return array_values(
            array_filter(
                array_map(fn($t) => is_string($t) ? trim($t) : '', $technologies),
                fn($t) => $t !== '' && strlen($t) <= 100  // Reject absurdly long strings
            )
        );
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
        $parsingStatus = strtolower((string) ($v3Response['parsing_status'] ?? 'success'));
        if (in_array($parsingStatus, ['timeout', 'error', 'empty_file', 'no_text'], true)) {
            Log::warning('Skipping skill refresh because CV parsing did not complete', [
                'user_id' => $user->id,
                'parsing_status' => $parsingStatus,
            ]);
            return new Collection();
        }

        $items = $v3Response['skills']['items'] ?? [];
        if (!is_array($items) || empty($items)) {
            Log::warning('No skills returned by V3 AI Gateway; preserving existing user skills', [
                'user_id' => $user->id,
            ]);
            return new Collection();
        }

        $skillPayloads = [];
        $syncData = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            $names = $this->expandSkillNames($item['name'] ?? '');
            if (empty($names)) {
                continue;
            }

            $category = (string) ($item['category'] ?? 'other');
            $type     = $this->mapSkillCategoryToType($category);

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

            foreach ($names as $name) {
                $skillPayloads[$name] = ['name' => $name, 'type' => $type];

                $syncData[$name] = [
                    'confidence_score' => $confidenceScore,
                    'evidence'         => $evidence ?: null,
                ];
            }
        }

        if (empty($skillPayloads)) {
            Log::warning('No valid skills extracted from V3 AI Gateway response; preserving existing user skills', [
                'user_id' => $user->id,
                'items_count' => count($items),
            ]);
            return new Collection();
        }

        $skills = $this->skillSyncService->findOrCreateMany(array_values($skillPayloads));
        $syncById = [];
        foreach ($skills as $skill) {
            if (!isset($syncData[$skill->name])) {
                continue;
            }

            $syncById[$skill->id] = $syncData[$skill->name];
        }

        if (empty($syncById)) {
            Log::warning('Extracted skills could not be mapped to skill records; preserving existing user skills', [
                'user_id' => $user->id,
                'items_count' => count($items),
            ]);
            return new Collection();
        }

        $user->skills()->sync($syncById);

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
     * @return list<string>
     */
    private function expandSkillNames(mixed $name): array
    {
        if (!is_scalar($name)) {
            return [];
        }

        $rawName = trim((string) $name);
        if ($rawName === '') {
            return [];
        }

        $parts = preg_split('/[,;]+/', $rawName) ?: [$rawName];
        $normalized = [];

        foreach ($parts as $part) {
            $skillName = $this->skillSyncService->normalizeName($part);
            if ($skillName !== null) {
                $normalized[$skillName] = $skillName;
            }
        }

        return array_values($normalized);
    }

    /**
     * Create or update CvAnalysis record with full Phase 4 analytics:
     * seniority, predicted_role, gaps, red_flags, skill_durations, action_verb_score, etc.
     *
     * The metadata JSON column stores career health details for frontend consumption.
     */
    private function persistCvAnalysis(User $user, array $v3Response, array $storedCv): void
    {
        $analysis = $v3Response['analysis'] ?? [];
        $expMeta  = $analysis['metadata']['experience'] ?? [];

        $completenessScore = null;
        if (isset($analysis['confidence_score'])) {
            $completenessScore = (int) round((float) $analysis['confidence_score'] * 100);
        }

        // Build structured metadata from AI response
        $metadata = $this->buildAnalysisMetadata($analysis, $v3Response);

        CvAnalysis::updateOrCreate(
            ['user_id' => $user->id],
            [
                'cv_disk'            => $storedCv['disk'],
                'cv_path'            => $storedCv['path'],
                'cv_original_name'   => $storedCv['original_name'],
                'cv_mime'            => $storedCv['mime'],
                'cv_size'            => $storedCv['size'],
                'cv_sha256'          => $storedCv['sha256'],
                'cv_uploaded_at'     => $storedCv['uploaded_at'],
                'parsing_status'     => (string) ($v3Response['parsing_status'] ?? 'success'),
                'seniority'          => $this->sanitizeString($analysis['seniority'] ?? null, CvAnalysis::SENIORITY_LEVELS),
                'predicted_role'     => $this->sanitizeStringValue($analysis['predicted_role'] ?? null, 200),
                'primary_domain'     => $this->sanitizeStringValue($analysis['primary_domain'] ?? null, 200),
                'confidence_score'   => isset($analysis['confidence_score']) ? (float) $analysis['confidence_score'] : null,
                'summary'            => $this->sanitizeStringValue($analysis['summary'] ?? null, 5000),
                'completeness_score' => $completenessScore,
                'strengths'          => $analysis['strengths'] ?? [],
                'gaps'               => $analysis['gaps'] ?? [],
                'red_flags'          => $analysis['red_flags'] ?? [],
                'metadata'           => $metadata,
                'raw_json_output'    => $v3Response,
            ]
        );

        Log::info('CvAnalysis persisted for user', [
            'user_id'   => $user->id,
            'seniority' => $analysis['seniority'] ?? null,
            'ocr_used'  => ($v3Response['parsing_status'] ?? '') === 'ocr_fallback',
        ]);
    }

    /**
     * Build the metadata JSON blob from AI analysis and experience data.
     *
     * @return array<string, mixed>
     */
    private function buildAnalysisMetadata(array $analysis, array $v3Response): array
    {
        $expMeta = $analysis['metadata']['experience'] ?? [];

        return [
            'error'               => is_string($analysis['metadata']['error'] ?? null)
                ? $this->sanitizeStringValue($analysis['metadata']['error'], 500)
                : null,
            'warnings'            => is_array($analysis['metadata']['warnings'] ?? null) ? $analysis['metadata']['warnings'] : [],
            'skill_durations'     => is_array($expMeta['skill_durations'] ?? null) ? $expMeta['skill_durations'] : [],
            'top_skills_by_years' => is_array($expMeta['top_skills_by_years'] ?? null) ? $expMeta['top_skills_by_years'] : [],
            'action_verb_score'   => is_numeric($expMeta['action_verb_score'] ?? null) ? (float) $expMeta['action_verb_score'] : 0.0,
            'gap_details'         => is_array($expMeta['gap_details'] ?? null) ? $expMeta['gap_details'] : [],
            'total_experience_years' => is_numeric($expMeta['total_experience_years'] ?? null) ? (float) $expMeta['total_experience_years'] : 0.0,
            'extraction_source'   => (string) ($analysis['metadata']['extraction']['source'] ?? 'unknown'),
            'spatial_status'      => (string) ($analysis['metadata']['extraction']['spatial_status'] ?? 'unknown'),
            'segmentation'        => $analysis['metadata']['segmentation'] ?? [],
        ];
    }

    /**
     * Sanitize a string value against an allowed list (for enum-like columns).
     * Returns null if the value is not in the allowed list.
     */
    private function sanitizeString(?string $value, array $allowed): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $lower = strtolower(trim($value));
        return in_array($lower, $allowed, true) ? $lower : null;
    }

    /**
     * Sanitize a free-text string value (trim + max length).
     */
    private function sanitizeStringValue(?string $value, int $maxLength): ?string
    {
        if ($value === null || trim($value) === '') {
            return null;
        }
        return Str::limit(trim($value), $maxLength, '');
    }

    /**
     * Build backward-compatible aiData for controller response.
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
            'seniority'          => $analysis['seniority'] ?? null,
            'predicted_role'     => $analysis['predicted_role'] ?? null,
            'profile'            => $v3Response['profile'] ?? [],
            'stats'              => $v3Response['stats'] ?? [],
            'skills'             => array_map(fn($s) => is_array($s) ? ($s['name'] ?? '') : (string) $s, $v3Response['skills']['items'] ?? []),
            'experience'         => $v3Response['experience'] ?? [],
            'analysis'           => $analysis,
            'warnings'           => is_array($metadata['warnings'] ?? null) ? $metadata['warnings'] : [],
        ];
    }

    private function correlationHeaders(): array
    {
        return app()->bound('request.id')
            ? [(string) config('observability.request_id_header', 'X-Request-ID') => app('request.id')]
            : [];
    }

    /**
     * @return array{value: string, source: string}|null
     */
    private function resolveRoleDiscoverySeed(array $v3Response): ?array
    {
        $analysis = is_array($v3Response['analysis'] ?? null) ? $v3Response['analysis'] : [];
        $profile = is_array($v3Response['profile'] ?? null) ? $v3Response['profile'] : [];

        $candidates = [
            'analysis.predicted_role' => $analysis['predicted_role'] ?? null,
            'profile.current_title' => $profile['current_title'] ?? null,
            'profile.headline' => $profile['headline'] ?? null,
            'analysis.primary_domain' => $analysis['primary_domain'] ?? null,
        ];

        foreach ($candidates as $source => $value) {
            $normalized = $this->sanitizeStringValue(is_string($value) ? $value : null, 200);
            if ($normalized !== null) {
                return ['value' => $normalized, 'source' => $source];
            }
        }

        return null;
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
            $existingScrape = ScrapingJob::where('job_title', $domain)
                ->whereIn('status', ['pending', 'processing', 'running'])
                ->latest()
                ->first();

            if ($existingScrape !== null) {
                Log::info('Background scraping already active for discovered role', [
                    'role' => $domain,
                    'scraping_job_id' => $existingScrape->id,
                    'status' => $existingScrape->status,
                ]);

                return true;
            }

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
