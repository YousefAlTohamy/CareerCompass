<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        // Demo-only convenience account for local/graduation defense setup.
        // This is not production authentication or a production admin provisioning flow.
        $name = trim((string) env('DEMO_ADMIN_NAME', 'Admin')) ?: 'Admin';
        $email = trim((string) env('DEMO_ADMIN_EMAIL', 'careercompassadmin@gmail.com')) ?: 'careercompassadmin@gmail.com';
        $password = (string) env('DEMO_ADMIN_PASSWORD', 'CareerCompassAdmin2026');

        if (trim($password) === '') {
            $password = 'CareerCompassAdmin2026';
        }

        User::updateOrCreate(
            ['email' => $email],
            [
                'name'     => $name,
                'email'    => $email,
                'password' => Hash::make($password),
                'role'     => 'admin',
            ]
        );

        $this->command->info("Demo admin user seeded: {$email}");
    }
}
