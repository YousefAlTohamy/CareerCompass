<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Seed skills first
        $this->call(SkillSeeder::class);

        // Seed real jobs from Egyptian job market
        $this->call(JobSeeder::class);

        // Seed scraping sources for the hybrid scraper admin panel
        $this->call(ScrapingSourceSeeder::class);

        // Seed default target job roles
        $this->call(TargetJobRoleSeeder::class);

        // Seed admin user account
        $this->call(AdminUserSeeder::class);

        // User::factory(10)->create();

        User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
        ]);
    }
}
