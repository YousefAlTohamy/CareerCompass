<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Job;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ApplicationTrackerTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_cannot_create_duplicate_applications_for_same_job(): void
    {
        $user = User::factory()->create();
        $job = Job::create([
            'title' => 'Backend Developer',
            'description' => 'Build APIs.',
            'company' => 'Career Compass',
            'url' => 'https://example.test/jobs/backend',
        ]);

        Sanctum::actingAs($user);

        $this->postJson('/api/applications', [
            'job_id' => $job->id,
            'status' => 'saved',
            'notes' => 'Looks interesting.',
        ])->assertOk()
            ->assertJsonPath('success', true);

        $this->postJson('/api/applications', [
            'job_id' => $job->id,
            'status' => 'applied',
            'notes' => 'Applied through company site.',
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'applied');

        $this->assertSame(1, Application::where('user_id', $user->id)->where('job_id', $job->id)->count());

        $application = Application::firstOrFail();
        $this->assertSame('applied', $application->status);
        $this->assertNotNull($application->applied_at);
    }
}
