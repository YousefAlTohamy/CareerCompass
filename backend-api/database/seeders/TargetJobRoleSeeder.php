<?php

namespace Database\Seeders;

use App\Models\TargetJobRole;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;

class TargetJobRoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        if (!Schema::hasTable('target_job_roles')) {
            $this->command->warn('Skipping TargetJobRoleSeeder: target_job_roles table does not exist.');
            return;
        }

        $roles = [
            ['name' => 'PHP Developer', 'search_query' => 'PHP Developer'],
            ['name' => 'Python Developer', 'search_query' => 'Python Developer'],
            ['name' => 'Full Stack Developer', 'search_query' => 'Full Stack Developer'],
            ['name' => 'Frontend Developer', 'search_query' => 'Frontend Developer'],
            ['name' => 'Backend Developer', 'search_query' => 'Backend Developer'],
            ['name' => 'DevOps Engineer', 'search_query' => 'DevOps Engineer'],
            ['name' => 'Data Scientist', 'search_query' => 'Data Scientist'],
            ['name' => 'Mobile Developer', 'search_query' => 'Mobile Developer'],
            ['name' => 'Backend Laravel Developer', 'search_query' => 'Backend Laravel Developer'],
            ['name' => 'Junior Laravel Developer', 'search_query' => 'Junior Laravel Developer'],
            ['name' => 'Mid-level Laravel Developer', 'search_query' => 'Laravel Developer'],
            ['name' => 'Senior Laravel Developer', 'search_query' => 'Senior Laravel Developer'],
            ['name' => 'PHP Laravel Developer', 'search_query' => 'PHP Laravel Developer'],
            ['name' => 'Backend API Developer', 'search_query' => 'Backend API Developer Laravel'],
            ['name' => 'Flutter Developer', 'search_query' => 'Flutter Developer'],
            ['name' => 'Junior Flutter Developer', 'search_query' => 'Junior Flutter Developer'],
            ['name' => 'Mobile App Developer Flutter', 'search_query' => 'Mobile App Developer Flutter'],
            ['name' => 'Flutter Firebase Developer', 'search_query' => 'Flutter Firebase Developer'],
            ['name' => 'Full Stack Laravel Developer', 'search_query' => 'Full Stack Laravel Developer'],
        ];

        foreach ($roles as $role) {
            TargetJobRole::updateOrCreate(
                ['name' => $role['name']],
                [
                    'search_query' => $role['search_query'],
                    'is_active' => true
                ]
            );
        }

        $this->command->info('Seeded/updated ' . count($roles) . ' active target job roles.');
    }
}
