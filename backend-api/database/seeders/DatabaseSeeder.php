<?php

namespace Database\Seeders;

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
        $this->call(SkillSeeder::class);
        $this->call(ScrapingSourceSeeder::class);
        $this->call(TargetJobRoleSeeder::class);
        $this->call(JobSeeder::class);
        $this->call(AdminUserSeeder::class);
        $this->call(DemoUserProfileSeeder::class);
        $this->call(ScrapingProxySeeder::class);
    }
}
