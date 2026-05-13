<?php

namespace Tests\Feature;

use App\Models\Job;
use App\Models\Skill;
use App\Models\User;
use App\Services\GapAnalysisService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GapAnalysisTest extends TestCase
{
    use RefreshDatabase;

    public function test_gap_analysis_uses_relational_skills_and_reports_missing_skills(): void
    {
        config(['services.ai_orchestrator.url' => 'http://ai-cv-analyzer:8000']);

        Http::fake([
            'http://ai-cv-analyzer:8000/api/hybrid-match' => Http::response([
                'hybrid_match_score' => 50,
                'semantic_score' => 0.4,
                'tfidf_score' => 0.6,
                'missing_skills' => ['Docker'],
            ], 200),
        ]);

        $user = User::factory()->create();
        $user->profile()->update([
            'headline' => 'Backend Developer',
            'summary' => 'PHP and Laravel engineer.',
        ]);

        $php = Skill::create(['name' => 'PHP', 'type' => 'technical']);
        $docker = Skill::create(['name' => 'Docker', 'type' => 'technical']);
        $user->skills()->attach($php->id);

        $job = Job::create([
            'title' => 'Backend Developer',
            'description' => 'Build PHP services and deploy with Docker.',
            'company' => 'Career Compass',
            'url' => 'https://example.test/jobs/gap',
        ]);

        $job->requiredSkills()->attach($php->id, [
            'required' => true,
            'importance_score' => 80,
            'importance_category' => 'essential',
        ]);
        $job->requiredSkills()->attach($docker->id, [
            'required' => true,
            'importance_score' => 75,
            'importance_category' => 'essential',
        ]);

        Sanctum::actingAs($user);

        $this->getJson("/api/gap-analysis/job/{$job->id}")
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.analysis.match_percentage', 50)
            ->assertJsonPath('data.analysis.matched_skills_count', 1)
            ->assertJsonPath('data.analysis.missing_skills_count', 1)
            ->assertJsonPath('data.analysis.missing_skills.0.name', 'Docker');
    }

    public function test_persist_user_profile_accepts_array_matched_skills(): void
    {
        $user = User::factory()->create();

        /** @var GapAnalysisService $service */
        $service = app(GapAnalysisService::class);

        $service->persistUserProfile($user, 'Backend Developer', [
            ['name' => 'Docker', 'type' => 'technical'],
            ['name' => 'Communication', 'type' => 'soft'],
        ]);

        $user->refresh()->load(['profile', 'skills']);

        $this->assertSame('Backend Developer', $user->profile?->headline);
        $this->assertCount(2, $user->skills);
        $this->assertDatabaseHas('skills', ['name' => 'Docker', 'type' => 'technical']);
        $this->assertDatabaseHas('skills', ['name' => 'Communication', 'type' => 'soft']);
    }

    public function test_gap_analysis_rejects_user_without_cv_profile_or_skills(): void
    {
        $user = User::factory()->create();
        $skill = Skill::create(['name' => 'Laravel', 'type' => 'technical']);
        $job = Job::create([
            'title' => 'Laravel Developer',
            'description' => 'Build Laravel APIs.',
            'company' => 'Career Compass',
            'url' => 'https://example.test/jobs/laravel',
        ]);
        $job->requiredSkills()->attach($skill->id, [
            'required' => true,
            'importance_score' => 80,
            'importance_category' => 'essential',
        ]);

        Sanctum::actingAs($user);

        $this->getJson("/api/gap-analysis/job/{$job->id}")
            ->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Upload a CV first so the system can extract skills and profile data.');
    }
}
