<?php

namespace Database\Seeders;

use App\Models\Skill;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;

class SkillSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        if (!Schema::hasTable('skills')) {
            $this->command->warn('Skipping SkillSeeder: skills table does not exist.');
            return;
        }

        $technicalSkills = [
            // Programming Languages
            'PHP',
            'PHP 8',
            'Python',
            'JavaScript',
            'Java',
            'C++',
            'C#',
            'Ruby',
            'Go',
            'TypeScript',
            'Swift',
            'Kotlin',
            'Scala',
            'Dart',

            // Web Frameworks
            'Laravel',
            'Laravel 10',
            'Laravel 11',
            'Laravel 12',
            'Eloquent ORM',
            'Blade',
            'Livewire',
            'Filament',
            'Inertia.js',
            'Django',
            'Flask',
            'FastAPI',
            'React',
            'Vue.js',
            'Angular',
            'Node.js',
            'Express.js',
            'Spring Boot',
            'ASP.NET',
            'Next.js',
            'Nuxt.js',
            'MVC',
            'MVVM',

            // Databases
            'MySQL',
            'PostgreSQL',
            'MongoDB',
            'Redis',
            'SQLite',
            'Oracle',
            'SQL Server',
            'MariaDB',
            'Elasticsearch',
            'Firestore',

            // DevOps & Tools
            'Docker',
            'Docker Compose',
            'Kubernetes',
            'Nginx',
            'Linux',
            'Git',
            'GitHub',
            'GitLab',
            'Jenkins',
            'CI/CD',
            'AWS',
            'Azure',
            'Google Cloud',
            'DigitalOcean',
            'Terraform',
            'Ansible',

            // Frontend
            'HTML',
            'CSS',
            'SASS',
            'Bootstrap',
            'Tailwind CSS',
            'jQuery',
            'Webpack',
            'Vite',
            'Responsive UI',
            'UI/UX',
            'UI/UX basics',

            // Mobile
            'React Native',
            'Flutter',
            'iOS',
            'Android',
            'Firebase',
            'Firebase Auth',
            'Push Notifications',
            'Dio',
            'Provider',
            'Riverpod',
            'Bloc',
            'Cubit',
            'GetX',
            'State Management',
            'App Deployment',
            'Google Play Console',

            // APIs, auth, testing, and architecture
            'REST API',
            'REST APIs',
            'REST API Design',
            'API Authentication',
            'GraphQL',
            'Microservices',
            'OAuth',
            'OAuth2',
            'JWT',
            'Sanctum',
            'Queues',
            'Jobs',
            'Events',
            'Listeners',
            'Notifications',
            'PHPUnit',
            'Pest',
            'Feature Testing',
            'Unit Testing',
            'TDD',
            'Feature Flags',
            'Payment Integration',
            'Payment Gateways',
            'Clean Architecture',
            'SOLID Principles',
            'Design Patterns',
            'Repository Pattern',
            'Agile',
            'Scrum'
        ];

        $softSkills = [
            'Communication',
            'Teamwork',
            'Leadership',
            'Problem Solving',
            'Time Management',
            'Critical Thinking',
            'Creativity',
            'Adaptability',
            'Work Ethic',
            'Attention to Detail',
            'Collaboration',
            'Interpersonal Skills',
            'Organizational Skills',
            'Decision Making',
            'Conflict Resolution',
            'Presentation Skills',
            'Analytical Skills',
            'Self-Motivation',
            'Learning Agility'
        ];

        $technicalCount = 0;
        foreach (array_values(array_unique($technicalSkills)) as $skill) {
            Skill::updateOrCreate(
                ['name' => $skill],
                ['type' => 'technical']
            );
            $technicalCount++;
        }

        $softCount = 0;
        foreach (array_values(array_unique($softSkills)) as $skill) {
            Skill::updateOrCreate(
                ['name' => $skill],
                ['type' => 'soft']
            );
            $softCount++;
        }

        $this->command->info("Seeded/updated {$technicalCount} technical skills and {$softCount} soft skills.");
    }
}
