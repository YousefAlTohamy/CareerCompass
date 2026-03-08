<?php

declare(strict_types=1);

namespace App\Services;

use App\Jobs\ProcessOnDemandJobScraping;
use App\Models\ScrapingJob;
use App\Models\Skill;
use App\Models\TargetJobRole;
use App\Models\User;
use App\Services\Contracts\CvProcessingServiceInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class CvProcessingService implements CvProcessingServiceInterface
{
    private string $gatewayUrl;
    private int $timeout;

    public function __construct()
    {
        $this->gatewayUrl = config('services.ai_gateway.url', 'http://127.0.0.1:8001');
        $this->timeout    = (int) config('services.ai_gateway.timeout', 30);
    }

    /**
     * Process the uploaded CV.
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
        // ── Step 1: Call AI Gateway ───────────────────────────────────
        $aiData = $this->callGateway($file);

        // ── Step 2: Update user profile & sync skills ──────────────────
        $this->updateUserProfile($user, $aiData);
        $syncedSkills = $this->syncUserSkills($user, $aiData['skills'] ?? []);

        // ── Step 3: Self-expanding role discovery ─────────────────────
        $domain    = $aiData['domain'] ?? null;
        $isNewRole = false;

        if ($domain !== null) {
            $isNewRole = $this->discoverNewRole((string) $domain);
        }

        return [
            'aiData'       => $aiData,
            'syncedSkills' => $syncedSkills,
            'isNewRole'    => $isNewRole,
            'domain'       => $domain,
        ];
    }

    /**
     * Send the uploaded CV to the AI Gateway's /parse-cv endpoint.
     *
     * @param  UploadedFile $file
     * @return array<string, mixed>
     *
     * @throws \Illuminate\Http\Client\ConnectionException
     * @throws \RuntimeException
     */
    private function callGateway(UploadedFile $file): array
    {
        $fileName = $file->getClientOriginalName();

        Log::info('Sending CV to AI Gateway', [
            'url'       => "{$this->gatewayUrl}/api/v1/parse-cv",
            'file_name' => $fileName,
            'file_size' => $file->getSize(),
        ]);

        $response = Http::timeout($this->timeout)
            ->attach(
                'cv_file',
                fopen($file->getPathname(), 'r'),
                (string) $fileName
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
            'skills_count'      => is_array($data['skills'] ?? null) ? count($data['skills']) : 0,
            'extraction_method' => $data['extraction_method'] ?? null,
        ]);

        return is_array($data) ? $data : [];
    }

    /**
     * Update the authenticated user's profile with data from the AI Gateway.
     *
     * @param  User $user
     * @param  array<string, mixed> $aiData
     */
    private function updateUserProfile(User $user, array $aiData): void
    {
        $contact = $aiData['contact_info'] ?? [];
        $contact = is_array($contact) ? $contact : [];

        $user->update([
            'job_title'    => $aiData['domain']              ?? $user->job_title,
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
     * @param  User               $user
     * @param  array<int, mixed>  $rawSkills
     * @return Collection<int, Skill>
     */
    private function syncUserSkills(User $user, array $rawSkills): Collection
    {
        if (empty($rawSkills)) {
            Log::warning('No skills returned by AI Gateway', ['user_id' => $user->id]);
            return new Collection();
        }

        $normalised = collect($rawSkills)->map(function ($item) {
            if (is_string($item)) {
                return ['name' => trim($item), 'type' => 'technical'];
            }
            if (is_array($item)) {
                return [
                    'name' => trim((string) ($item['name'] ?? '')),
                    'type' => (string) ($item['type'] ?? 'technical'),
                ];
            }
            return ['name' => '', 'type' => 'technical'];
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
            'new_skills'    => $missing->count(),
        ]);

        return $skills;
    }

    /**
     * Self-expanding role discovery.
     *
     * @param  string $domain
     * @return bool
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
