<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class TargetJobRoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $roles = [
            ['name' => 'PHP Developer', 'search_query' => 'PHP Developer'],
            ['name' => 'Python Developer', 'search_query' => 'Python Developer'],
            ['name' => 'Full Stack Developer', 'search_query' => 'Full Stack Developer'],
            ['name' => 'Frontend Developer', 'search_query' => 'Frontend Developer'],
            ['name' => 'Backend Developer', 'search_query' => 'Backend Developer'],
            ['name' => 'DevOps Engineer', 'search_query' => 'DevOps Engineer'],
            ['name' => 'Data Scientist', 'search_query' => 'Data Scientist'],
            ['name' => 'Mobile Developer', 'search_query' => 'Mobile Developer'],
        ];

        foreach ($roles as $role) {
            \App\Models\TargetJobRole::updateOrCreate(
                ['name' => $role['name']],
                [
                    'search_query' => $role['search_query'],
                    'is_active' => true
                ]
            );
        }
    }
}
