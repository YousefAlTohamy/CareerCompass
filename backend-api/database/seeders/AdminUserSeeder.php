<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'careercompassadmin@gmail.com'],
            [
                'name'     => 'Admin',
                'email'    => 'careercompassadmin@gmail.com',
                'password' => Hash::make('CareerCompassAdmin2026'),
                'role'     => 'admin',
            ]
        );

        $this->command->info('Admin user seeded: careercompassadmin@gmail.com');
    }
}
