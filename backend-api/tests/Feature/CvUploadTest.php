<?php

namespace Tests\Feature;

use App\Models\CvAnalysis;
use App\Models\Skill;
use App\Models\TargetJobRole;
use App\Models\User;
use App\Models\UserExperience;
use App\Services\CvStorageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CvUploadTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @var list<string>
     */
    private const INTERNAL_STORAGE_HOSTS = [
        'minio',
        'db',
        'backend-api',
        'ai-cv-analyzer',
        'ai-job-miner',
        'nginx',
    ];

    public function test_cv_upload_requires_authentication(): void
    {
        $this->withHeader('Accept', 'application/json')
            ->post('/api/upload-cv', [
                'cv' => UploadedFile::fake()->create('resume.pdf', 80, 'application/pdf'),
            ])
            ->assertUnauthorized();
    }

    public function test_cv_upload_rejects_invalid_file_type(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->post('/api/upload-cv', [
            'cv' => UploadedFile::fake()->create('notes.txt', 10, 'text/plain'),
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('cv');
    }

    public function test_cv_upload_rejects_oversized_file(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->post('/api/upload-cv', [
            'cv' => UploadedFile::fake()->create('huge-resume.pdf', 6000, 'application/pdf'),
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('cv');
    }

    public function test_cv_upload_persists_profile_analysis_and_normalized_skills(): void
    {
        config(['services.ai_cv_analyzer.url' => 'http://ai-cv-analyzer:8000']);
        Storage::fake('local');
        Queue::fake();

        Http::fake([
            'http://ai-cv-analyzer:8000/api/parse-cv' => Http::response([
                'parsing_status' => 'success',
                'profile' => [
                    'current_title' => 'Backend Developer',
                    'summary' => 'Builds APIs and data workflows.',
                    'contact' => [
                        'email' => 'dev@example.test',
                        'location' => 'Cairo',
                    ],
                ],
                'analysis' => [
                    'seniority' => 'mid',
                    'predicted_role' => 'Backend Developer',
                    'primary_domain' => '',
                    'confidence_score' => 0.91,
                    'summary' => 'Strong backend profile.',
                    'strengths' => ['API design'],
                    'gaps' => ['Docker depth'],
                    'red_flags' => [],
                    'metadata' => [
                        'experience' => [
                            'total_experience_years' => 3,
                            'skill_durations' => [],
                            'top_skills_by_years' => [],
                            'action_verb_score' => 0.7,
                            'gap_details' => [],
                        ],
                        'extraction' => [
                            'source' => 'test',
                            'spatial_status' => 'text',
                        ],
                        'segmentation' => [],
                    ],
                ],
                'skills' => [
                    'items' => [
                        ['name' => 'php', 'category' => 'technical', 'confidence_score' => 0.94],
                        ['name' => 'Laravel', 'category' => 'technical', 'confidence_score' => 0.9],
                        ['name' => 'Communication', 'category' => 'soft', 'confidence_score' => 0.8],
                    ],
                ],
                'experience' => [
                    'items' => [
                        [
                            'title' => 'Software Engineer',
                            'company' => 'Acme',
                            'start_date' => '2021-01-01',
                            'end_date' => null,
                            'is_current' => true,
                            'description' => ['Built Laravel services.'],
                            'technologies' => ['PHP', 'Laravel'],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->post('/api/upload-cv', [
            'cv' => UploadedFile::fake()->create('resume.pdf', 80, 'application/pdf'),
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.parsing_status', 'success')
            ->assertJsonPath('data.skills_count', 3)
            ->assertJsonPath('data.predicted_role', 'Backend Developer')
            ->assertJsonPath('data.profile_updated', true)
            ->assertJsonPath('data.retry_available', false)
            ->assertJsonPath('user.profile.headline', 'Backend Developer')
            ->assertJsonPath('user.cv_analysis.cv_file.original_name', 'resume.pdf')
            ->assertJsonPath('user.cv_analysis.cv_file.mime', 'application/pdf');

        $user->refresh()->load(['profile', 'skills', 'experiences']);

        $this->assertSame('Backend Developer', $user->profile->headline);
        $this->assertSame('Cairo', $user->profile->location);
        $this->assertEqualsCanonicalizing(['Communication', 'Laravel', 'PHP'], $user->skills->pluck('name')->all());
        $this->assertSame(3, Skill::count());
        $this->assertSame(1, $user->experiences()->count());
        $analysis = CvAnalysis::where('user_id', $user->id)->firstOrFail();

        $this->assertNotNull($analysis->cv_path);
        $this->assertSame('resume.pdf', $analysis->cv_original_name);
        $this->assertSame('application/pdf', $analysis->cv_mime);
        $this->assertDatabaseHas('cv_analyses', [
            'user_id' => $user->id,
            'predicted_role' => 'Backend Developer',
            'seniority' => 'mid',
        ]);
        Storage::disk($analysis->cv_disk)->assertExists($analysis->cv_path);
        $this->assertSame(91, $analysis->completeness_score);

        $downloadUrlResponse = $this->getJson('/api/user/cv-analysis/download-url')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['url', 'expires_at']]);

        $downloadUrl = $downloadUrlResponse->json('data.url');
        $this->assertIsString($downloadUrl);
        $this->assertBrowserSafeCvUrl($downloadUrl);
    }

    public function test_cv_upload_preserves_existing_skills_when_ai_returns_empty_skills(): void
    {
        config(['services.ai_cv_analyzer.url' => 'http://ai-cv-analyzer:8000']);
        Storage::fake('local');
        Queue::fake();

        Http::fake([
            'http://ai-cv-analyzer:8000/api/parse-cv' => Http::response([
                'parsing_status' => 'success',
                'profile' => [
                    'current_title' => 'Backend Developer',
                    'summary' => 'Builds APIs.',
                    'contact' => [],
                ],
                'analysis' => [
                    'seniority' => 'mid',
                    'predicted_role' => 'Backend Developer',
                    'primary_domain' => 'Software Engineering',
                    'confidence_score' => 0.8,
                    'summary' => 'Parsed but no skills extracted.',
                    'strengths' => [],
                    'gaps' => [],
                    'red_flags' => [],
                    'metadata' => [],
                ],
                'skills' => ['items' => []],
                'experience' => ['items' => []],
            ], 200),
        ]);

        $user = User::factory()->create();
        $existingSkill = Skill::create(['name' => 'Docker', 'type' => 'technical']);
        $user->skills()->attach($existingSkill->id, [
            'confidence_score' => 0.9,
            'evidence' => 'manual profile',
        ]);

        Sanctum::actingAs($user);

        $this->post('/api/upload-cv', [
            'cv' => UploadedFile::fake()->create('resume.pdf', 80, 'application/pdf'),
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('parsing_status', 'success')
            ->assertJsonPath('warnings.0.code', 'no_skills_extracted');

        $user->refresh()->load('skills');

        $this->assertEqualsCanonicalizing(['Docker'], $user->skills->pluck('name')->all());
        $this->assertDatabaseHas('cv_analyses', [
            'user_id' => $user->id,
            'parsing_status' => 'success',
        ]);
    }

    public function test_cv_upload_preserves_existing_experience_when_ai_returns_empty_experience(): void
    {
        config(['services.ai_cv_analyzer.url' => 'http://ai-cv-analyzer:8000']);
        Storage::fake('local');
        Queue::fake();

        Http::fake([
            'http://ai-cv-analyzer:8000/api/parse-cv' => Http::response([
                'parsing_status' => 'success',
                'profile' => [
                    'current_title' => 'Backend Developer',
                    'summary' => 'Builds APIs.',
                    'contact' => [],
                ],
                'analysis' => [
                    'seniority' => 'mid',
                    'predicted_role' => 'Backend Developer',
                    'primary_domain' => 'Software Engineering',
                    'confidence_score' => 0.8,
                    'summary' => 'Parsed but no experience extracted.',
                    'strengths' => [],
                    'gaps' => [],
                    'red_flags' => [],
                    'metadata' => [],
                ],
                'skills' => [
                    'items' => [
                        ['name' => 'Laravel', 'category' => 'technical', 'confidence_score' => 0.9],
                    ],
                ],
                'experience' => ['items' => []],
            ], 200),
        ]);

        $user = User::factory()->create();
        UserExperience::create([
            'user_id' => $user->id,
            'title' => 'Existing Developer',
            'company' => 'Existing Co',
            'is_current' => true,
            'description' => 'Manual history.',
        ]);

        Sanctum::actingAs($user);

        $this->post('/api/upload-cv', [
            'cv' => UploadedFile::fake()->create('resume.pdf', 80, 'application/pdf'),
        ])->assertOk()
            ->assertJsonPath('success', true);

        $user->refresh();

        $this->assertSame(1, $user->experiences()->count());
        $this->assertDatabaseHas('user_experiences', [
            'user_id' => $user->id,
            'title' => 'Existing Developer',
            'company' => 'Existing Co',
        ]);
    }

    public function test_ai_unavailable_returns_safe_retry_response(): void
    {
        config(['services.ai_cv_analyzer.url' => 'http://ai-cv-analyzer:8000']);
        Storage::fake('local');

        Http::fake([
            'http://ai-cv-analyzer:8000/api/parse-cv' => function () {
                throw new ConnectionException('secret upstream socket detail');
            },
        ]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->post('/api/upload-cv', [
            'cv' => UploadedFile::fake()->create('resume.pdf', 80, 'application/pdf'),
        ]);

        $response->assertStatus(503)
            ->assertJsonPath('success', false)
            ->assertJsonPath('parsing_status', 'error')
            ->assertJsonPath('data.retry_available', true)
            ->assertJsonPath('warnings.0.code', 'ai_unavailable')
            ->assertJsonMissing(['error' => 'secret upstream socket detail']);
    }

    public function test_malformed_ai_response_is_stored_as_error_without_wiping_existing_profile_data(): void
    {
        config(['services.ai_cv_analyzer.url' => 'http://ai-cv-analyzer:8000']);
        Storage::fake('local');
        Queue::fake();

        Http::fake([
            'http://ai-cv-analyzer:8000/api/parse-cv' => Http::response([
                'unexpected' => true,
            ], 200),
        ]);

        $user = User::factory()->create();
        $existingSkill = Skill::create(['name' => 'Docker', 'type' => 'technical']);
        $user->skills()->attach($existingSkill->id, [
            'confidence_score' => 0.9,
            'evidence' => 'manual profile',
        ]);
        $user->profile()->update([
            'headline' => 'Manual Backend Developer',
            'summary' => 'Manual profile summary.',
        ]);
        UserExperience::create([
            'user_id' => $user->id,
            'title' => 'Existing Developer',
            'company' => 'Existing Co',
            'is_current' => true,
        ]);

        Sanctum::actingAs($user);

        $this->post('/api/upload-cv', [
            'cv' => UploadedFile::fake()->create('resume.pdf', 80, 'application/pdf'),
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('parsing_status', 'error')
            ->assertJsonPath('data.profile_updated', false)
            ->assertJsonPath('warnings.0.code', 'ai_error');

        $user->refresh()->load(['profile', 'skills']);
        $analysis = CvAnalysis::where('user_id', $user->id)->firstOrFail();

        $this->assertSame('Manual Backend Developer', $user->profile->headline);
        $this->assertEqualsCanonicalizing(['Docker'], $user->skills->pluck('name')->all());
        $this->assertSame(1, $user->experiences()->count());
        $this->assertSame('error', $analysis->parsing_status);
        $this->assertSame(
            'AI response did not include expected CV analysis fields.',
            $analysis->metadata['error']
        );
    }

    public function test_no_text_ai_status_is_returned_as_safe_upload_warning(): void
    {
        config(['services.ai_cv_analyzer.url' => 'http://ai-cv-analyzer:8000']);
        Storage::fake('local');
        Queue::fake();

        Http::fake([
            'http://ai-cv-analyzer:8000/api/parse-cv' => Http::response([
                'parsing_status' => 'no_text',
                'profile' => [],
                'analysis' => [
                    'metadata' => [
                        'error' => 'No readable text was extracted.',
                    ],
                ],
                'skills' => ['items' => []],
                'experience' => ['items' => []],
            ], 200),
        ]);

        $user = User::factory()->create();
        $existingSkill = Skill::create(['name' => 'Laravel', 'type' => 'technical']);
        $user->skills()->attach($existingSkill->id);

        Sanctum::actingAs($user);

        $this->post('/api/upload-cv', [
            'cv' => UploadedFile::fake()->create('scanned.pdf', 80, 'application/pdf'),
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('parsing_status', 'no_text')
            ->assertJsonPath('data.retry_available', true)
            ->assertJsonPath('data.profile_updated', false)
            ->assertJsonPath('warnings.0.code', 'no_readable_text');

        $user->refresh()->load('skills');
        $analysis = CvAnalysis::where('user_id', $user->id)->firstOrFail();

        $this->assertEqualsCanonicalizing(['Laravel'], $user->skills->pluck('name')->all());
        $this->assertSame('no_text', $analysis->parsing_status);
        $this->assertNotNull($analysis->cv_path);
    }

    public function test_unsigned_cv_download_route_is_rejected(): void
    {
        Storage::fake('local');

        $user = User::factory()->create();
        Storage::disk('local')->put('cv-uploads/users/1/test.pdf', '%PDF-1.4 test');
        $analysis = CvAnalysis::create([
            'user_id' => $user->id,
            'cv_disk' => 'local',
            'cv_path' => 'cv-uploads/users/1/test.pdf',
            'cv_original_name' => 'resume.pdf',
            'cv_mime' => 'application/pdf',
            'cv_size' => 16,
            'cv_sha256' => hash('sha256', 'test'),
            'cv_uploaded_at' => now(),
            'parsing_status' => 'success',
        ]);

        $this->get("/api/cv-files/{$analysis->id}")
            ->assertForbidden();

        $signedUrl = URL::temporarySignedRoute('api.cv.download', now()->addMinute(), [
            'cvAnalysis' => $analysis->id,
        ]);

        $this->get($signedUrl)->assertOk();
    }

    public function test_cv_download_url_uses_app_signed_route_for_s3_minio_storage(): void
    {
        config([
            'app.url' => 'http://localhost',
            'filesystems.cv_uploads.disk' => 's3',
            'filesystems.disks.s3.bucket' => 'career-compass',
            'filesystems.disks.s3.endpoint' => 'http://minio:9000',
            'filesystems.disks.s3.url' => 'http://minio:9000/career-compass',
            'filesystems.disks.s3.use_path_style_endpoint' => true,
        ]);

        Storage::fake('s3');

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $path = "cv-uploads/users/{$user->id}/test.pdf";
        Storage::disk('s3')->put($path, '%PDF-1.4 test');

        $analysis = CvAnalysis::create([
            'user_id' => $user->id,
            'cv_disk' => 's3',
            'cv_path' => $path,
            'cv_original_name' => 'resume.pdf',
            'cv_mime' => 'application/pdf',
            'cv_size' => 16,
            'cv_sha256' => hash('sha256', 'test'),
            'cv_uploaded_at' => now(),
            'parsing_status' => 'success',
        ]);

        $url = app(CvStorageService::class)->temporaryDownloadUrl($analysis);

        $this->assertBrowserSafeCvUrl($url);
        $this->assertStringContainsString("/api/cv-files/{$analysis->id}", $url);

        $downloadUrlResponse = $this->getJson('/api/user/cv-analysis/download-url')
            ->assertOk()
            ->assertJsonPath('success', true);

        $downloadUrl = $downloadUrlResponse->json('data.url');
        $this->assertIsString($downloadUrl);
        $this->assertBrowserSafeCvUrl($downloadUrl);

        $this->get("/api/cv-files/{$analysis->id}")
            ->assertForbidden();

        $this->get($downloadUrl)
            ->assertOk();
    }

    public function test_user_resource_cv_url_is_browser_safe_for_s3_minio_storage(): void
    {
        config([
            'app.url' => 'http://localhost',
            'filesystems.cv_uploads.disk' => 's3',
            'filesystems.disks.s3.bucket' => 'career-compass',
            'filesystems.disks.s3.endpoint' => 'http://minio:9000',
            'filesystems.disks.s3.url' => 'http://minio:9000/career-compass',
            'filesystems.disks.s3.use_path_style_endpoint' => true,
        ]);

        Storage::fake('s3');

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $path = "cv-uploads/users/{$user->id}/resource.pdf";
        Storage::disk('s3')->put($path, '%PDF-1.4 test');

        CvAnalysis::create([
            'user_id' => $user->id,
            'cv_disk' => 's3',
            'cv_path' => $path,
            'cv_original_name' => 'resource.pdf',
            'cv_mime' => 'application/pdf',
            'cv_size' => 16,
            'cv_sha256' => hash('sha256', 'resource'),
            'cv_uploaded_at' => now(),
            'parsing_status' => 'success',
        ]);

        $response = $this->getJson('/api/user')
            ->assertOk();

        $cvUrl = $response->json('data.cv_url');
        $this->assertIsString($cvUrl);
        $this->assertBrowserSafeCvUrl($cvUrl);
    }

    public function test_cv_upload_splits_comma_delimited_skill_labels(): void
    {
        config(['services.ai_cv_analyzer.url' => 'http://ai-cv-analyzer:8000']);
        Storage::fake('local');
        Queue::fake();

        Http::fake([
            'http://ai-cv-analyzer:8000/api/parse-cv' => Http::response([
                'parsing_status' => 'success',
                'profile' => [
                    'current_title' => 'Full Stack Developer',
                    'summary' => 'Builds Laravel and React applications.',
                    'contact' => [],
                ],
                'analysis' => [
                    'seniority' => 'mid',
                    'predicted_role' => 'Full Stack Developer',
                    'primary_domain' => 'Software Engineering',
                    'confidence_score' => 0.86,
                    'summary' => 'Strong full-stack profile.',
                    'strengths' => [],
                    'gaps' => [],
                    'red_flags' => [],
                    'metadata' => [],
                ],
                'skills' => [
                    'items' => [
                        ['name' => 'PHP, LARAVEL, Docker', 'category' => 'technical', 'confidence_score' => 0.92],
                    ],
                ],
                'experience' => ['items' => []],
            ], 200),
        ]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->post('/api/upload-cv', [
            'cv' => UploadedFile::fake()->create('resume.pdf', 80, 'application/pdf'),
        ])->assertOk()
            ->assertJsonPath('success', true);

        $user->refresh()->load('skills');

        $this->assertEqualsCanonicalizing(['Docker', 'Laravel', 'PHP'], $user->skills->pluck('name')->all());
        $this->assertSame(3, Skill::count());
    }

    public function test_cv_upload_discovers_predicted_role_before_primary_domain(): void
    {
        config(['services.ai_cv_analyzer.url' => 'http://ai-cv-analyzer:8000']);
        Storage::fake('local');
        Queue::fake();

        Http::fake([
            'http://ai-cv-analyzer:8000/api/parse-cv' => Http::response([
                'parsing_status' => 'success',
                'profile' => [
                    'current_title' => 'React Developer',
                    'summary' => 'Builds frontend applications.',
                    'contact' => [],
                ],
                'analysis' => [
                    'seniority' => 'mid',
                    'predicted_role' => 'Frontend React Developer',
                    'primary_domain' => 'Software Engineering',
                    'confidence_score' => 0.88,
                    'summary' => 'Frontend specialist.',
                    'strengths' => [],
                    'gaps' => [],
                    'red_flags' => [],
                    'metadata' => [],
                ],
                'skills' => [
                    'items' => [
                        ['name' => 'React', 'category' => 'technical', 'confidence_score' => 0.9],
                    ],
                ],
                'experience' => ['items' => []],
            ], 200),
        ]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->post('/api/upload-cv', [
            'cv' => UploadedFile::fake()->create('frontend.pdf', 80, 'application/pdf'),
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('is_new_role', true);

        $this->assertTrue(TargetJobRole::where('name', 'Frontend React Developer')->exists());
        $this->assertFalse(TargetJobRole::where('name', 'Software Engineering')->exists());
    }

    private function assertBrowserSafeCvUrl(string $url): void
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));

        $this->assertSame('localhost', $host);
        $this->assertNotContains($host, self::INTERNAL_STORAGE_HOSTS);
        $this->assertStringContainsString('/api/cv-files/', $url);
        $this->assertStringNotContainsString('minio:9000', strtolower($url));

        foreach (self::INTERNAL_STORAGE_HOSTS as $internalHost) {
            $this->assertStringNotContainsString("://{$internalHost}", strtolower($url));
            $this->assertStringNotContainsString("//{$internalHost}", strtolower($url));
        }
    }
}
