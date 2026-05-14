<?php

namespace Tests\Feature;

use App\Models\CvAnalysis;
use App\Models\Skill;
use App\Models\TargetJobRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CvUploadTest extends TestCase
{
    use RefreshDatabase;

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

        $this->getJson('/api/user/cv-analysis/download-url')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['url', 'expires_at']]);
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
}
