<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register_login_and_update_profile_with_skills(): void
    {
        $this->postJson('/api/register', [
            'name' => 'Nour Hassan',
            'email' => 'nour@gmail.com',
            'password' => 'Secret123',
        ])->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['token']]);

        $this->postJson('/api/login', [
            'email' => 'nour@gmail.com',
            'password' => 'Secret123',
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['token']]);

        $user = User::where('email', 'nour@gmail.com')->firstOrFail();
        Sanctum::actingAs($user);

        $this->putJson('/api/user/profile', [
            'name' => 'Nour Hassan',
            'email' => 'nour@gmail.com',
            'job_title' => 'Laravel Developer',
            'location' => 'Cairo',
            'skills' => ['php', 'Laravel', 'php'],
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.headline', 'Laravel Developer');

        $user->refresh()->load(['profile', 'skills']);

        $this->assertSame('Laravel Developer', $user->profile->headline);
        $this->assertEqualsCanonicalizing(['Laravel', 'PHP'], $user->skills->pluck('name')->all());
    }
}
