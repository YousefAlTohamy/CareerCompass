<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\UserProfile>
 *
 * Usage: UserProfile::factory()->for($user)->create() to add fake profile data.
 * User model auto-creates empty profile on creation; use this to replace with fake data.
 */
class UserProfileFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $user = User::withoutEvents(fn () => User::factory()->create());

        return [
            'user_id'               => $user->id,
            'headline'              => fake()->jobTitle(),
            'summary'               => fake()->paragraph(),
            'location'              => fake()->city() . ', ' . fake()->country(),
            'total_experience_years' => fake()->randomFloat(2, 0, 25),
            'seniority'             => fake()->randomElement(['Junior', 'Mid', 'Senior', 'Lead']),
            'primary_domain'        => fake()->randomElement(['Backend Development', 'Frontend Development', 'Full Stack', 'DevOps', 'Data Science']),
            'contact_info'          => [
                'phone'        => fake()->phoneNumber(),
                'linkedin_url' => 'https://linkedin.com/in/' . fake()->userName(),
                'github_url'   => 'https://github.com/' . fake()->userName(),
            ],
        ];
    }
}
