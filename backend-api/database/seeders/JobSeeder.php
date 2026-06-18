<?php

namespace Database\Seeders;

use App\Models\Job;
use App\Models\ScrapingSource;
use App\Models\Skill;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class JobSeeder extends Seeder
{
    private array $softSkills = [
        'Communication',
        'Teamwork',
        'Problem Solving',
        'Attention to Detail',
        'Time Management',
        'Presentation Skills',
        'Learning Agility',
    ];

    public function run(): void
    {
        if (!Schema::hasTable('job_postings')) {
            $this->command->warn('Skipping JobSeeder: job_postings table does not exist.');
            return;
        }

        [$jobCount, $jobSkillCount] = DB::transaction(function (): array {
            $sourceIds = Schema::hasTable('scraping_sources')
                ? ScrapingSource::query()->pluck('id', 'name')->all()
                : [];

            $canAttachSkills = Schema::hasTable('skills') && Schema::hasTable('job_skills');
            $jobCount = 0;
            $jobSkillCount = 0;
            $now = Carbon::now();

            foreach ($this->jobs() as $index => $jobData) {
                $createdAt = $now->copy()
                    ->subDays(($index % 45) + 1)
                    ->setTime(9 + ($index % 8), ($index * 7) % 60);
                $updatedAt = $createdAt->copy()->addHours(8 + (($index % 5) * 6));
                $skillGroups = [
                    'essential' => $jobData['essential'],
                    'important' => $jobData['important'],
                    'nice_to_have' => $jobData['nice_to_have'],
                ];
                $allSkillNames = $this->flattenSkillGroups($skillGroups);

                $payload = $this->filterColumns('job_postings', [
                    'title' => $jobData['title'],
                    'company' => $jobData['company'],
                    'description' => $this->descriptionFor($jobData),
                    'requirements' => $this->requirementsFor($jobData, $allSkillNames),
                    'location' => $jobData['location'],
                    'salary_range' => $jobData['salary_range'],
                    'job_type' => $jobData['job_type'],
                    'experience' => $jobData['experience'],
                    'skills' => $allSkillNames,
                    'work_type' => $jobData['work_type'],
                    'source' => $jobData['source'],
                    'scraping_source_id' => $sourceIds[$jobData['source']] ?? null,
                    'url' => $jobData['url'],
                    'created_at' => $createdAt,
                    'updated_at' => $updatedAt,
                ]);

                $job = Job::query()
                    ->where('url', $jobData['url'])
                    ->orWhere(function ($query) use ($jobData): void {
                        $query->where('title', $jobData['title'])
                            ->where('company', $jobData['company']);
                    })
                    ->first();

                if (!$job) {
                    $job = new Job();
                }

                $job->forceFill($payload)->save();
                $jobCount++;

                if ($canAttachSkills) {
                    foreach ($skillGroups as $category => $skillNames) {
                        foreach (array_values(array_unique($skillNames)) as $position => $skillName) {
                            $skill = Skill::firstOrCreate(
                                ['name' => $skillName],
                                ['type' => $this->skillType($skillName)]
                            );

                            DB::table('job_skills')->updateOrInsert(
                                [
                                    'job_id' => $job->id,
                                    'skill_id' => $skill->id,
                                ],
                                [
                                    'required' => true,
                                    'importance_score' => $this->importanceScore($category, $position),
                                    'importance_category' => $category,
                                    'created_at' => $createdAt,
                                    'updated_at' => $updatedAt,
                                ]
                            );
                            $jobSkillCount++;
                        }
                    }
                }
            }

            return [$jobCount, $jobSkillCount];
        });

        $this->command->info("Seeded/updated {$jobCount} demo job postings and {$jobSkillCount} job-skill relations.");
    }

    private function filterColumns(string $table, array $attributes): array
    {
        return array_filter(
            $attributes,
            fn ($value, string $column): bool => Schema::hasColumn($table, $column),
            ARRAY_FILTER_USE_BOTH
        );
    }

    private function flattenSkillGroups(array $skillGroups): array
    {
        return array_values(array_unique(array_merge(
            $skillGroups['essential'],
            $skillGroups['important'],
            $skillGroups['nice_to_have'],
        )));
    }

    private function skillType(string $skillName): string
    {
        return in_array($skillName, $this->softSkills, true) ? 'soft' : 'technical';
    }

    private function importanceScore(string $category, int $position): float
    {
        return match ($category) {
            'essential' => round(max(84, 96 - ($position * 2)), 2),
            'important' => round(max(64, 78 - ($position * 2)), 2),
            default => round(max(42, 58 - ($position * 2)), 2),
        };
    }

    private function descriptionFor(array $job): string
    {
        if ($job['family'] === 'flutter') {
            return implode("\n", [
                "Build polished Flutter features for {$job['focus']} with clean, reusable Dart code.",
                'Integrate REST APIs, Firebase services, push notifications, and production-ready mobile workflows.',
                'Work with state management patterns such as Provider, Riverpod, Bloc, or Cubit based on the feature needs.',
                'Collaborate with backend and product teams to prepare stable Android and iOS releases for real users.',
            ]);
        }

        if ($job['family'] === 'support') {
            return implode("\n", [
                "Contribute to {$job['focus']} in a team that ships practical software for MENA customers.",
                'Work closely with backend, frontend, mobile, QA, and DevOps teammates on clear release goals.',
                'Improve API reliability, dashboards, deployment workflows, automated testing, and production observability.',
                'Document decisions, communicate tradeoffs, and keep Git-based delivery predictable across the team.',
            ]);
        }

        return implode("\n", [
            "Develop Laravel backend features for {$job['focus']} with secure, maintainable PHP code.",
            'Build REST APIs, authentication flows, admin dashboards, reporting screens, and third-party integrations.',
            'Use MySQL, Redis, queues, tests, Git workflows, and Docker-based environments in day-to-day delivery.',
            'Collaborate with frontend and mobile teams to provide stable API contracts and production-ready releases.',
        ]);
    }

    private function requirementsFor(array $job, array $skills): string
    {
        $topSkills = implode(', ', array_slice($skills, 0, 9));

        if ($job['family'] === 'flutter') {
            return implode("\n", [
                "{$job['experience']} of hands-on mobile development experience.",
                "Practical experience with {$topSkills}.",
                'Ability to consume REST APIs, manage local state, handle errors, and build responsive UI.',
                'Comfort using Git, code reviews, debugging tools, and Android or iOS release preparation.',
            ]);
        }

        if ($job['family'] === 'support') {
            return implode("\n", [
                "{$job['experience']} of relevant software delivery experience.",
                "Practical experience with {$topSkills}.",
                'Comfort working across APIs, dashboards, automated checks, deployment pipelines, and production incidents.',
                'Clear written communication, ownership mindset, and attention to maintainable implementation details.',
            ]);
        }

        return implode("\n", [
            "{$job['experience']} of backend or PHP/Laravel development experience.",
            "Practical experience with {$topSkills}.",
            'Ability to design REST APIs, model relational data, write tests, and debug production-style issues.',
            'Comfort with Git workflows, Docker-based local setup, and collaborative delivery with frontend/mobile teams.',
        ]);
    }

    private function jobs(): array
    {
        $laravelEssential = ['PHP', 'Laravel', 'MySQL', 'REST API', 'Git', 'Docker'];
        $laravelImportant = ['Eloquent ORM', 'API Authentication', 'Sanctum', 'Redis', 'Queues', 'Feature Testing'];
        $laravelNice = ['AWS', 'CI/CD', 'Docker Compose', 'Nginx', 'Clean Architecture', 'SOLID Principles'];

        $flutterEssential = ['Dart', 'Flutter', 'REST APIs', 'State Management', 'Git', 'Android'];
        $flutterImportant = ['Firebase', 'Dio', 'Provider', 'Bloc', 'Responsive UI', 'Push Notifications'];
        $flutterNice = ['iOS', 'Riverpod', 'Clean Architecture', 'App Deployment', 'Google Play Console', 'Unit Testing'];

        return [
            [
                'family' => 'laravel',
                'title' => 'Junior Backend Laravel Developer',
                'company' => 'NileCode Labs',
                'focus' => 'internal CRM modules and customer support dashboards',
                'location' => 'Cairo, Egypt',
                'salary_range' => '10,000 - 16,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '1-2 years',
                'work_type' => 'Onsite',
                'source' => 'Wuzzuf Egypt',
                'url' => 'https://wuzzuf.net/jobs/demo-careercompass-laravel-backend-001',
                'essential' => array_merge($laravelEssential, ['HTML', 'CSS']),
                'important' => ['Eloquent ORM', 'JWT', 'MVC', 'Feature Testing', 'Problem Solving'],
                'nice_to_have' => ['Redis', 'Queues', 'Docker Compose', 'CI/CD', 'Communication'],
            ],
            [
                'family' => 'laravel',
                'title' => 'Backend Laravel Developer',
                'company' => 'FinPay Egypt',
                'focus' => 'payment APIs, merchant dashboards, and reconciliation jobs',
                'location' => 'Smart Village, Egypt',
                'salary_range' => '18,000 - 28,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '2-4 years',
                'work_type' => 'Hybrid',
                'source' => 'LinkedIn Global',
                'url' => 'https://linkedin.com/jobs/view/demo-careercompass-laravel-backend-002',
                'essential' => array_merge($laravelEssential, ['Laravel 11']),
                'important' => array_merge($laravelImportant, ['Payment Integration']),
                'nice_to_have' => array_merge($laravelNice, ['OAuth2']),
            ],
            [
                'family' => 'laravel',
                'title' => 'PHP Laravel Developer',
                'company' => 'Delta Digital Solutions',
                'focus' => 'B2B ordering portals and regional inventory tools',
                'location' => 'Mansoura, Egypt',
                'salary_range' => '13,000 - 21,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '2+ years',
                'work_type' => 'Onsite',
                'source' => 'Wuzzuf Egypt',
                'url' => 'https://wuzzuf.net/jobs/demo-careercompass-laravel-backend-003',
                'essential' => array_merge($laravelEssential, ['PHP 8']),
                'important' => ['Eloquent ORM', 'Blade', 'Livewire', 'API Authentication', 'Unit Testing', 'Problem Solving'],
                'nice_to_have' => ['Redis', 'Queues', 'Repository Pattern', 'Design Patterns', 'Teamwork'],
            ],
            [
                'family' => 'laravel',
                'title' => 'Mid-Level Laravel Backend Engineer',
                'company' => 'CairoTech Studio',
                'focus' => 'SaaS billing modules and admin operations tooling',
                'location' => 'New Cairo, Egypt',
                'salary_range' => '22,000 - 34,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '3-5 years',
                'work_type' => 'Hybrid',
                'source' => 'CareerCompass Demo Jobs',
                'url' => 'https://careercompass.test/jobs/demo-careercompass-laravel-backend-004',
                'essential' => array_merge($laravelEssential, ['Laravel 12']),
                'important' => array_merge($laravelImportant, ['PHPUnit']),
                'nice_to_have' => array_merge($laravelNice, ['Design Patterns']),
            ],
            [
                'family' => 'laravel',
                'title' => 'Laravel API Developer',
                'company' => 'MedConnect MENA',
                'focus' => 'healthcare booking APIs and doctor-facing reporting panels',
                'location' => 'Maadi, Cairo',
                'salary_range' => '18,000 - 30,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '2-4 years',
                'work_type' => 'Hybrid',
                'source' => 'Remotive Remote Jobs',
                'url' => 'https://remotive.com/remote-jobs/software-dev/demo-careercompass-laravel-backend-005',
                'essential' => array_merge($laravelEssential, ['REST API Design']),
                'important' => ['Eloquent ORM', 'Sanctum', 'PostgreSQL', 'Notifications', 'Feature Testing', 'Attention to Detail'],
                'nice_to_have' => ['Redis', 'Queues', 'AWS', 'Clean Architecture', 'OAuth2'],
            ],
            [
                'family' => 'laravel',
                'title' => 'Backend API Developer (Laravel)',
                'company' => 'EduGate Systems',
                'focus' => 'student portals, admissions workflows, and school integrations',
                'location' => 'Nasr City, Cairo',
                'salary_range' => '15,000 - 24,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '2-3 years',
                'work_type' => 'Onsite',
                'source' => 'Wuzzuf Egypt',
                'url' => 'https://wuzzuf.net/jobs/demo-careercompass-laravel-backend-006',
                'essential' => array_merge($laravelEssential, ['API Authentication']),
                'important' => ['Eloquent ORM', 'JWT', 'Events', 'Listeners', 'Feature Testing', 'Communication'],
                'nice_to_have' => ['Redis', 'Queues', 'Docker Compose', 'Nginx', 'Learning Agility'],
            ],
            [
                'family' => 'laravel',
                'title' => 'Laravel Developer for SaaS Platform',
                'company' => 'CloudSoft Egypt',
                'focus' => 'subscription management, tenant dashboards, and usage analytics',
                'location' => 'Hybrid - Cairo, Egypt',
                'salary_range' => '20,000 - 32,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '3+ years',
                'work_type' => 'Hybrid',
                'source' => 'LinkedIn Global',
                'url' => 'https://linkedin.com/jobs/view/demo-careercompass-laravel-backend-007',
                'essential' => array_merge($laravelEssential, ['Laravel 10']),
                'important' => ['Eloquent ORM', 'Redis', 'Queues', 'Pest', 'Clean Architecture', 'SOLID Principles'],
                'nice_to_have' => ['AWS', 'CI/CD', 'Docker Compose', 'Inertia.js', 'Presentation Skills'],
            ],
            [
                'family' => 'laravel',
                'title' => 'Senior Laravel Developer',
                'company' => 'PayLink MENA',
                'focus' => 'high-volume payment callbacks and merchant onboarding flows',
                'location' => 'Giza, Egypt',
                'salary_range' => '35,000 - 55,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '5+ years',
                'work_type' => 'Hybrid',
                'source' => 'LinkedIn Global',
                'url' => 'https://linkedin.com/jobs/view/demo-careercompass-laravel-backend-008',
                'essential' => array_merge($laravelEssential, ['PostgreSQL', 'Redis']),
                'important' => ['Queues', 'Events', 'Listeners', 'PHPUnit', 'Clean Architecture', 'Payment Gateways'],
                'nice_to_have' => ['AWS', 'CI/CD', 'Microservices', 'OAuth2', 'Leadership'],
            ],
            [
                'family' => 'laravel',
                'title' => 'PHP Backend Developer - E-commerce Platform',
                'company' => 'SouqLine',
                'focus' => 'catalog, checkout, coupons, and seller dashboard services',
                'location' => 'Alexandria, Egypt',
                'salary_range' => '16,000 - 26,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '2-4 years',
                'work_type' => 'Onsite',
                'source' => 'Wuzzuf Egypt',
                'url' => 'https://wuzzuf.net/jobs/demo-careercompass-laravel-backend-009',
                'essential' => array_merge($laravelEssential, ['PHP 8']),
                'important' => ['Eloquent ORM', 'Redis', 'Queues', 'Payment Integration', 'Unit Testing', 'Problem Solving'],
                'nice_to_have' => ['Elasticsearch', 'Docker Compose', 'Repository Pattern', 'CI/CD', 'Teamwork'],
            ],
            [
                'family' => 'laravel',
                'title' => 'Laravel Dashboard Developer',
                'company' => 'AdminPro Solutions',
                'focus' => 'admin dashboards, operational reports, and permission-based back offices',
                'location' => 'Remote',
                'salary_range' => '1,100 - 1,800 USD',
                'job_type' => 'Full-time',
                'experience' => '2+ years',
                'work_type' => 'Remote',
                'source' => 'RemoteOK Remote Jobs',
                'url' => 'https://remoteok.com/remote-jobs/demo-careercompass-laravel-backend-010',
                'essential' => array_merge($laravelEssential, ['Blade']),
                'important' => ['Filament', 'Livewire', 'Eloquent ORM', 'Feature Testing', 'API Authentication', 'Communication'],
                'nice_to_have' => ['Inertia.js', 'Tailwind CSS', 'Redis', 'CI/CD', 'Presentation Skills'],
            ],
            [
                'family' => 'laravel',
                'title' => 'Backend Laravel Developer - Logistics Platform',
                'company' => 'MoveIt Tech',
                'focus' => 'shipment tracking APIs, dispatch dashboards, and driver notifications',
                'location' => 'New Cairo, Egypt',
                'salary_range' => '21,000 - 33,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '3+ years',
                'work_type' => 'Hybrid',
                'source' => 'CareerCompass Demo Jobs',
                'url' => 'https://careercompass.test/jobs/demo-careercompass-laravel-backend-011',
                'essential' => array_merge($laravelEssential, ['Redis']),
                'important' => ['Queues', 'Events', 'Notifications', 'Sanctum', 'Feature Testing', 'Time Management'],
                'nice_to_have' => ['AWS', 'Docker Compose', 'Clean Architecture', 'Microservices', 'Learning Agility'],
            ],
            [
                'family' => 'laravel',
                'title' => 'Laravel Integration Developer',
                'company' => 'BankTech Solutions',
                'focus' => 'banking partner integrations, webhook processing, and audit logs',
                'location' => 'Smart Village, Egypt',
                'salary_range' => '25,000 - 42,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '4+ years',
                'work_type' => 'Hybrid',
                'source' => 'LinkedIn Global',
                'url' => 'https://linkedin.com/jobs/view/demo-careercompass-laravel-backend-012',
                'essential' => array_merge($laravelEssential, ['REST API Design', 'PostgreSQL']),
                'important' => ['OAuth2', 'API Authentication', 'Queues', 'PHPUnit', 'Clean Architecture', 'Attention to Detail'],
                'nice_to_have' => ['AWS', 'CI/CD', 'Linux', 'Nginx', 'Design Patterns'],
            ],
            [
                'family' => 'laravel',
                'title' => 'Junior PHP Laravel Developer',
                'company' => 'CodeBridge Academy',
                'focus' => 'learning platform APIs, instructor dashboards, and student progress reports',
                'location' => 'Cairo, Egypt',
                'salary_range' => '8,000 - 13,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '0-1 years',
                'work_type' => 'Onsite',
                'source' => 'Wuzzuf Egypt',
                'url' => 'https://wuzzuf.net/jobs/demo-careercompass-laravel-backend-013',
                'essential' => ['PHP', 'Laravel', 'MySQL', 'REST API', 'Git', 'HTML', 'CSS'],
                'important' => ['MVC', 'Eloquent ORM', 'JWT', 'Unit Testing', 'Problem Solving', 'Communication'],
                'nice_to_have' => ['Docker', 'Redis', 'Queues', 'Learning Agility', 'Teamwork'],
            ],
            [
                'family' => 'laravel',
                'title' => 'Laravel Developer (Queues & Redis)',
                'company' => 'RetailHub Egypt',
                'focus' => 'order processing workers, stock synchronization, and notification pipelines',
                'location' => 'Hybrid - Cairo, Egypt',
                'salary_range' => '24,000 - 38,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '3-5 years',
                'work_type' => 'Hybrid',
                'source' => 'Wuzzuf Egypt',
                'url' => 'https://wuzzuf.net/jobs/demo-careercompass-laravel-backend-014',
                'essential' => array_merge($laravelEssential, ['Redis', 'Queues']),
                'important' => ['Events', 'Listeners', 'Notifications', 'PHPUnit', 'Docker Compose', 'Attention to Detail'],
                'nice_to_have' => ['AWS', 'CI/CD', 'Microservices', 'Repository Pattern', 'Linux'],
            ],
            [
                'family' => 'laravel',
                'title' => 'Backend Developer Laravel/MySQL',
                'company' => 'HealthStack MENA',
                'focus' => 'clinic management APIs, appointment workflows, and analytics exports',
                'location' => 'Maadi, Cairo',
                'salary_range' => '18,000 - 29,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '2-4 years',
                'work_type' => 'Hybrid',
                'source' => 'CareerCompass Demo Jobs',
                'url' => 'https://careercompass.test/jobs/demo-careercompass-laravel-backend-015',
                'essential' => array_merge($laravelEssential, ['Laravel 10']),
                'important' => ['Eloquent ORM', 'Sanctum', 'Feature Testing', 'Notifications', 'Clean Architecture', 'Communication'],
                'nice_to_have' => ['Redis', 'Queues', 'AWS', 'Docker Compose', 'SOLID Principles'],
            ],
            [
                'family' => 'laravel',
                'title' => 'Laravel API Engineer',
                'company' => 'TravelTech Arabia',
                'focus' => 'booking APIs, provider integrations, and traveler notification workflows',
                'location' => 'Remote',
                'salary_range' => '1,400 - 2,300 USD',
                'job_type' => 'Full-time',
                'experience' => '3+ years',
                'work_type' => 'Remote',
                'source' => 'Remotive Remote Jobs',
                'url' => 'https://remotive.com/remote-jobs/software-dev/demo-careercompass-laravel-backend-016',
                'essential' => array_merge($laravelEssential, ['REST API Design']),
                'important' => ['PostgreSQL', 'Redis', 'Queues', 'Pest', 'API Authentication', 'Problem Solving'],
                'nice_to_have' => ['AWS', 'CI/CD', 'OAuth2', 'Microservices', 'Presentation Skills'],
            ],
            [
                'family' => 'laravel',
                'title' => 'PHP Laravel Backend Developer',
                'company' => 'InsureSoft Egypt',
                'focus' => 'insurance quote engines, document workflows, and broker dashboards',
                'location' => 'Nasr City, Cairo',
                'salary_range' => '20,000 - 34,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '3+ years',
                'work_type' => 'Onsite',
                'source' => 'LinkedIn Global',
                'url' => 'https://linkedin.com/jobs/view/demo-careercompass-laravel-backend-017',
                'essential' => array_merge($laravelEssential, ['PHP 8']),
                'important' => ['Eloquent ORM', 'Sanctum', 'Redis', 'Queues', 'PHPUnit', 'Attention to Detail'],
                'nice_to_have' => ['AWS', 'Docker Compose', 'Clean Architecture', 'Design Patterns', 'Time Management'],
            ],
            [
                'family' => 'laravel',
                'title' => 'Laravel Backend Engineer - GovTech Portal',
                'company' => 'CivicSoft Egypt',
                'focus' => 'public-service request APIs, audit trails, and role-based dashboards',
                'location' => 'Giza, Egypt',
                'salary_range' => '22,000 - 36,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '3-5 years',
                'work_type' => 'Hybrid',
                'source' => 'Arbeitnow Job Board',
                'url' => 'https://www.arbeitnow.com/jobs/demo-careercompass-laravel-backend-018',
                'essential' => array_merge($laravelEssential, ['Laravel 11']),
                'important' => ['PostgreSQL', 'API Authentication', 'Feature Testing', 'Notifications', 'Clean Architecture', 'Communication'],
                'nice_to_have' => ['Linux', 'Nginx', 'CI/CD', 'Docker Compose', 'Presentation Skills'],
            ],
            [
                'family' => 'laravel',
                'title' => 'Laravel Developer - Reporting Dashboards',
                'company' => 'DataPulse Egypt',
                'focus' => 'BI exports, scheduled reports, and customer-facing analytics dashboards',
                'location' => 'New Cairo, Egypt',
                'salary_range' => '19,000 - 31,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '2-4 years',
                'work_type' => 'Hybrid',
                'source' => 'Wuzzuf Egypt',
                'url' => 'https://wuzzuf.net/jobs/demo-careercompass-laravel-backend-019',
                'essential' => array_merge($laravelEssential, ['Blade']),
                'important' => ['Livewire', 'Eloquent ORM', 'Queues', 'Feature Testing', 'Redis', 'Attention to Detail'],
                'nice_to_have' => ['Filament', 'Tailwind CSS', 'AWS', 'CI/CD', 'Teamwork'],
            ],
            [
                'family' => 'laravel',
                'title' => 'Senior PHP Laravel API Developer',
                'company' => 'MENA Commerce Cloud',
                'focus' => 'marketplace APIs, seller integrations, and high-volume order workflows',
                'location' => 'Remote',
                'salary_range' => '1,800 - 3,000 USD',
                'job_type' => 'Full-time',
                'experience' => '5+ years',
                'work_type' => 'Remote',
                'source' => 'Remotive Remote Jobs',
                'url' => 'https://remotive.com/remote-jobs/software-dev/demo-careercompass-laravel-backend-020',
                'essential' => array_merge($laravelEssential, ['Redis', 'PostgreSQL']),
                'important' => ['Queues', 'Microservices', 'PHPUnit', 'Clean Architecture', 'SOLID Principles', 'Payment Gateways'],
                'nice_to_have' => ['AWS', 'Kubernetes', 'CI/CD', 'OAuth2', 'Leadership'],
            ],

            [
                'family' => 'flutter',
                'title' => 'Junior Flutter Developer',
                'company' => 'AppCraft Egypt',
                'focus' => 'consumer mobile screens, onboarding flows, and API-backed profile features',
                'location' => 'Cairo, Egypt',
                'salary_range' => '9,000 - 15,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '0-1 years',
                'work_type' => 'Onsite',
                'source' => 'Wuzzuf Egypt',
                'url' => 'https://wuzzuf.net/jobs/demo-careercompass-flutter-001',
                'essential' => ['Dart', 'Flutter', 'REST APIs', 'Git', 'Android', 'Responsive UI'],
                'important' => ['Firebase Auth', 'Firestore', 'Provider', 'Dio', 'Problem Solving'],
                'nice_to_have' => ['Bloc', 'iOS', 'App Deployment', 'Google Play Console', 'Communication'],
            ],
            [
                'family' => 'flutter',
                'title' => 'Flutter Developer - Food Delivery App',
                'company' => 'BiteTech MENA',
                'focus' => 'restaurant ordering, courier tracking, and customer notification features',
                'location' => 'New Cairo, Egypt',
                'salary_range' => '16,000 - 26,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '2-4 years',
                'work_type' => 'Hybrid',
                'source' => 'LinkedIn Global',
                'url' => 'https://linkedin.com/jobs/view/demo-careercompass-flutter-002',
                'essential' => array_merge($flutterEssential, ['Firebase']),
                'important' => array_merge($flutterImportant, ['Cubit']),
                'nice_to_have' => array_merge($flutterNice, ['Google Cloud']),
            ],
            [
                'family' => 'flutter',
                'title' => 'Flutter Firebase Developer',
                'company' => 'SchoolLink Egypt',
                'focus' => 'school communication apps, parent notifications, and attendance dashboards',
                'location' => 'Giza, Egypt',
                'salary_range' => '14,000 - 23,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '1-3 years',
                'work_type' => 'Onsite',
                'source' => 'Wuzzuf Egypt',
                'url' => 'https://wuzzuf.net/jobs/demo-careercompass-flutter-003',
                'essential' => ['Dart', 'Flutter', 'Firebase', 'Firebase Auth', 'Firestore', 'REST APIs'],
                'important' => ['Dio', 'Provider', 'Push Notifications', 'Responsive UI', 'Git', 'Teamwork'],
                'nice_to_have' => ['Bloc', 'Riverpod', 'iOS', 'App Deployment', 'Learning Agility'],
            ],
            [
                'family' => 'flutter',
                'title' => 'Mobile App Developer Flutter',
                'company' => 'HealthMobile',
                'focus' => 'appointment booking, medication reminders, and telehealth mobile experiences',
                'location' => 'Maadi, Cairo',
                'salary_range' => '15,000 - 25,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '2+ years',
                'work_type' => 'Hybrid',
                'source' => 'CareerCompass Demo Jobs',
                'url' => 'https://careercompass.test/jobs/demo-careercompass-flutter-004',
                'essential' => array_merge($flutterEssential, ['Firebase Auth']),
                'important' => ['Dio', 'Bloc', 'Push Notifications', 'Responsive UI', 'Clean Architecture', 'Communication'],
                'nice_to_have' => ['Firestore', 'iOS', 'Unit Testing', 'Google Play Console', 'App Deployment'],
            ],
            [
                'family' => 'flutter',
                'title' => 'Flutter Developer - Fintech Wallet',
                'company' => 'Walleta',
                'focus' => 'wallet onboarding, transaction history, QR payments, and security-first mobile flows',
                'location' => 'Smart Village, Egypt',
                'salary_range' => '20,000 - 34,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '3+ years',
                'work_type' => 'Hybrid',
                'source' => 'LinkedIn Global',
                'url' => 'https://linkedin.com/jobs/view/demo-careercompass-flutter-005',
                'essential' => array_merge($flutterEssential, ['Firebase Auth']),
                'important' => ['Dio', 'Bloc', 'Clean Architecture', 'Unit Testing', 'Push Notifications', 'Attention to Detail'],
                'nice_to_have' => ['iOS', 'App Deployment', 'Payment Integration', 'CI/CD', 'Google Play Console'],
            ],
            [
                'family' => 'flutter',
                'title' => 'Mid-Level Flutter Developer',
                'company' => 'TravelMate MENA',
                'focus' => 'travel booking, saved trips, and offline-friendly itinerary features',
                'location' => 'Remote',
                'salary_range' => '1,200 - 2,000 USD',
                'job_type' => 'Full-time',
                'experience' => '3-5 years',
                'work_type' => 'Remote',
                'source' => 'Remotive Remote Jobs',
                'url' => 'https://remotive.com/remote-jobs/software-dev/demo-careercompass-flutter-006',
                'essential' => array_merge($flutterEssential, ['iOS']),
                'important' => ['Riverpod', 'Dio', 'Firebase', 'Clean Architecture', 'App Deployment', 'Time Management'],
                'nice_to_have' => ['Bloc', 'Unit Testing', 'CI/CD', 'Google Play Console', 'Presentation Skills'],
            ],
            [
                'family' => 'flutter',
                'title' => 'Flutter Engineer (Dart & REST APIs)',
                'company' => 'Bazaar Mobile',
                'focus' => 'marketplace listings, chat, orders, and seller mobile tools',
                'location' => 'Nasr City, Cairo',
                'salary_range' => '15,000 - 24,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '2-3 years',
                'work_type' => 'Onsite',
                'source' => 'Wuzzuf Egypt',
                'url' => 'https://wuzzuf.net/jobs/demo-careercompass-flutter-007',
                'essential' => array_merge($flutterEssential, ['Dio']),
                'important' => ['Firebase', 'Provider', 'Bloc', 'Responsive UI', 'Push Notifications', 'Problem Solving'],
                'nice_to_have' => ['iOS', 'Riverpod', 'Unit Testing', 'App Deployment', 'Teamwork'],
            ],
            [
                'family' => 'flutter',
                'title' => 'Flutter Developer for E-commerce App',
                'company' => 'Cartly Egypt',
                'focus' => 'shopping carts, product discovery, checkout screens, and push campaigns',
                'location' => 'Alexandria, Egypt',
                'salary_range' => '13,000 - 22,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '1-3 years',
                'work_type' => 'Hybrid',
                'source' => 'CareerCompass Demo Jobs',
                'url' => 'https://careercompass.test/jobs/demo-careercompass-flutter-008',
                'essential' => array_merge($flutterEssential, ['Firebase']),
                'important' => ['Dio', 'Provider', 'Push Notifications', 'Responsive UI', 'Payment Integration', 'Communication'],
                'nice_to_have' => ['Bloc', 'iOS', 'Unit Testing', 'Google Play Console', 'App Deployment'],
            ],
            [
                'family' => 'flutter',
                'title' => 'Mobile Flutter Developer - Logistics Tracking',
                'company' => 'TrackNow',
                'focus' => 'driver tracking, delivery status updates, and customer shipment visibility',
                'location' => 'Hybrid - Cairo, Egypt',
                'salary_range' => '18,000 - 29,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '2-4 years',
                'work_type' => 'Hybrid',
                'source' => 'Wuzzuf Egypt',
                'url' => 'https://wuzzuf.net/jobs/demo-careercompass-flutter-009',
                'essential' => array_merge($flutterEssential, ['Push Notifications']),
                'important' => ['Firebase', 'Dio', 'Bloc', 'Responsive UI', 'Clean Architecture', 'Problem Solving'],
                'nice_to_have' => ['iOS', 'App Deployment', 'Unit Testing', 'Google Play Console', 'CI/CD'],
            ],
            [
                'family' => 'flutter',
                'title' => 'Flutter Developer (Firebase & Push Notifications)',
                'company' => 'NotifyHub',
                'focus' => 'real-time notification campaigns, user preferences, and mobile engagement tools',
                'location' => 'Remote',
                'salary_range' => '1,000 - 1,700 USD',
                'job_type' => 'Contract',
                'experience' => '2+ years',
                'work_type' => 'Remote',
                'source' => 'RemoteOK Remote Jobs',
                'url' => 'https://remoteok.com/remote-jobs/demo-careercompass-flutter-010',
                'essential' => ['Dart', 'Flutter', 'Firebase', 'Firebase Auth', 'Push Notifications', 'REST APIs'],
                'important' => ['Firestore', 'Dio', 'Riverpod', 'Responsive UI', 'Git', 'Communication'],
                'nice_to_have' => ['Bloc', 'iOS', 'Unit Testing', 'App Deployment', 'Google Play Console'],
            ],
            [
                'family' => 'flutter',
                'title' => 'Junior Mobile Developer Flutter',
                'company' => 'PixelApps Mansoura',
                'focus' => 'UI implementation, Firebase auth screens, and small API integration tasks',
                'location' => 'Mansoura, Egypt',
                'salary_range' => '7,000 - 12,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '0-1 years',
                'work_type' => 'Onsite',
                'source' => 'Wuzzuf Egypt',
                'url' => 'https://wuzzuf.net/jobs/demo-careercompass-flutter-011',
                'essential' => ['Dart', 'Flutter', 'Firebase Auth', 'Firestore', 'REST APIs', 'Git'],
                'important' => ['Responsive UI', 'Provider', 'Dio', 'UI/UX basics', 'Problem Solving'],
                'nice_to_have' => ['Bloc', 'Android', 'App Deployment', 'Communication', 'Learning Agility'],
            ],
            [
                'family' => 'flutter',
                'title' => 'Flutter Clean Architecture Developer',
                'company' => 'AgileApps MENA',
                'focus' => 'modular mobile architecture, reusable feature packages, and API-heavy product flows',
                'location' => 'Remote',
                'salary_range' => '1,500 - 2,500 USD',
                'job_type' => 'Full-time',
                'experience' => '3+ years',
                'work_type' => 'Remote',
                'source' => 'Remotive Remote Jobs',
                'url' => 'https://remotive.com/remote-jobs/software-dev/demo-careercompass-flutter-012',
                'essential' => array_merge($flutterEssential, ['Clean Architecture']),
                'important' => ['Riverpod', 'Bloc', 'Dio', 'Unit Testing', 'CI/CD', 'SOLID Principles'],
                'nice_to_have' => ['iOS', 'App Deployment', 'Google Play Console', 'Firebase', 'Presentation Skills'],
            ],
            [
                'family' => 'flutter',
                'title' => 'Flutter Developer Android/iOS',
                'company' => 'MediaStream Egypt',
                'focus' => 'streaming app screens, subscriptions, and media discovery features',
                'location' => 'New Cairo, Egypt',
                'salary_range' => '17,000 - 28,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '2-4 years',
                'work_type' => 'Hybrid',
                'source' => 'LinkedIn Global',
                'url' => 'https://linkedin.com/jobs/view/demo-careercompass-flutter-013',
                'essential' => array_merge($flutterEssential, ['iOS']),
                'important' => ['Dio', 'Bloc', 'Firebase', 'App Deployment', 'Responsive UI', 'Attention to Detail'],
                'nice_to_have' => ['Push Notifications', 'Unit Testing', 'Google Play Console', 'CI/CD', 'Teamwork'],
            ],
            [
                'family' => 'flutter',
                'title' => 'Flutter UI Developer',
                'company' => 'EduKids App',
                'focus' => 'interactive learning screens, responsive layouts, and child-friendly app flows',
                'location' => 'Cairo, Egypt',
                'salary_range' => '10,000 - 18,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '1-2 years',
                'work_type' => 'Onsite',
                'source' => 'Wuzzuf Egypt',
                'url' => 'https://wuzzuf.net/jobs/demo-careercompass-flutter-014',
                'essential' => ['Dart', 'Flutter', 'Responsive UI', 'REST APIs', 'Git', 'Android'],
                'important' => ['Provider', 'Dio', 'Firebase', 'UI/UX basics', 'Problem Solving', 'Communication'],
                'nice_to_have' => ['Bloc', 'Riverpod', 'iOS', 'App Deployment', 'Unit Testing'],
            ],
            [
                'family' => 'flutter',
                'title' => 'Senior Flutter Developer - Telehealth Platform',
                'company' => 'CareWave MENA',
                'focus' => 'telehealth calls, secure patient flows, and production mobile release pipelines',
                'location' => 'Remote',
                'salary_range' => '2,000 - 3,200 USD',
                'job_type' => 'Full-time',
                'experience' => '5+ years',
                'work_type' => 'Remote',
                'source' => 'Indeed Remote',
                'url' => 'https://indeed.com/viewjob?jk=demo-careercompass-flutter-015',
                'essential' => array_merge($flutterEssential, ['iOS', 'Clean Architecture']),
                'important' => ['Riverpod', 'Bloc', 'Dio', 'Unit Testing', 'App Deployment', 'Attention to Detail'],
                'nice_to_have' => ['Firebase', 'Push Notifications', 'CI/CD', 'Google Play Console', 'Leadership'],
            ],

            [
                'family' => 'support',
                'title' => 'Full Stack Laravel Vue Developer',
                'company' => 'BrightSoft Egypt',
                'focus' => 'Laravel APIs, Vue admin panels, and operational SaaS dashboards',
                'location' => 'Hybrid - Cairo, Egypt',
                'salary_range' => '22,000 - 36,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '3+ years',
                'work_type' => 'Hybrid',
                'source' => 'Wuzzuf Egypt',
                'url' => 'https://wuzzuf.net/jobs/demo-careercompass-mixed-001',
                'essential' => ['PHP', 'Laravel', 'Vue.js', 'JavaScript', 'MySQL', 'REST API', 'Git'],
                'important' => ['Eloquent ORM', 'Docker', 'Tailwind CSS', 'API Authentication', 'Feature Testing', 'Teamwork'],
                'nice_to_have' => ['Inertia.js', 'Redis', 'Queues', 'CI/CD', 'Clean Architecture'],
            ],
            [
                'family' => 'support',
                'title' => 'Full Stack Laravel React Developer',
                'company' => 'MarketGrid MENA',
                'focus' => 'seller dashboards, React screens, and Laravel API integrations',
                'location' => 'New Cairo, Egypt',
                'salary_range' => '24,000 - 40,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '3-5 years',
                'work_type' => 'Hybrid',
                'source' => 'LinkedIn Global',
                'url' => 'https://linkedin.com/jobs/view/demo-careercompass-mixed-002',
                'essential' => ['PHP', 'Laravel', 'React', 'JavaScript', 'MySQL', 'REST API', 'Git'],
                'important' => ['Docker', 'Sanctum', 'Tailwind CSS', 'Feature Testing', 'Clean Architecture', 'Communication'],
                'nice_to_have' => ['Redis', 'Queues', 'AWS', 'CI/CD', 'Design Patterns'],
            ],
            [
                'family' => 'support',
                'title' => 'DevOps Engineer for Laravel Applications',
                'company' => 'DeployMate Egypt',
                'focus' => 'Dockerized Laravel deployments, queues, Nginx, and CI/CD release workflows',
                'location' => 'Remote',
                'salary_range' => '1,600 - 2,700 USD',
                'job_type' => 'Full-time',
                'experience' => '4+ years',
                'work_type' => 'Remote',
                'source' => 'Remotive Remote Jobs',
                'url' => 'https://remotive.com/remote-jobs/software-dev/demo-careercompass-mixed-003',
                'essential' => ['Docker', 'Docker Compose', 'Linux', 'Nginx', 'CI/CD', 'Git', 'AWS'],
                'important' => ['Laravel', 'PHP', 'Redis', 'Queues', 'MySQL', 'Problem Solving'],
                'nice_to_have' => ['Kubernetes', 'Terraform', 'DigitalOcean', 'Monitoring', 'Communication'],
            ],
            [
                'family' => 'support',
                'title' => 'Backend API Developer - Node & Laravel Integrations',
                'company' => 'ConnectAPI',
                'focus' => 'service integrations, partner APIs, and migration work between Node.js and Laravel systems',
                'location' => 'Maadi, Cairo',
                'salary_range' => '20,000 - 33,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '3+ years',
                'work_type' => 'Hybrid',
                'source' => 'CareerCompass Demo Jobs',
                'url' => 'https://careercompass.test/jobs/demo-careercompass-mixed-004',
                'essential' => ['REST API', 'Node.js', 'Laravel', 'PHP', 'JavaScript', 'MySQL', 'Git'],
                'important' => ['Express.js', 'API Authentication', 'Docker', 'PostgreSQL', 'Feature Testing', 'Problem Solving'],
                'nice_to_have' => ['Redis', 'Queues', 'Microservices', 'AWS', 'Clean Architecture'],
            ],
            [
                'family' => 'support',
                'title' => 'QA Automation Engineer for Web & Mobile',
                'company' => 'QualityHub Egypt',
                'focus' => 'automated checks for Laravel APIs, Flutter apps, and admin dashboards',
                'location' => 'Nasr City, Cairo',
                'salary_range' => '14,000 - 24,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '2+ years',
                'work_type' => 'Onsite',
                'source' => 'Wuzzuf Egypt',
                'url' => 'https://wuzzuf.net/jobs/demo-careercompass-mixed-005',
                'essential' => ['Feature Testing', 'Unit Testing', 'REST API', 'Git', 'Attention to Detail', 'Problem Solving'],
                'important' => ['PHPUnit', 'Pest', 'Laravel', 'Flutter', 'CI/CD', 'Communication'],
                'nice_to_have' => ['Docker', 'Postman', 'Selenium', 'Agile', 'Teamwork'],
            ],
            [
                'family' => 'support',
                'title' => 'Frontend React Developer - SaaS Dashboard',
                'company' => 'UIWorks Cairo',
                'focus' => 'React dashboards that consume Laravel APIs and visualize operational metrics',
                'location' => 'Cairo, Egypt',
                'salary_range' => '16,000 - 27,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '2-4 years',
                'work_type' => 'Hybrid',
                'source' => 'LinkedIn Global',
                'url' => 'https://linkedin.com/jobs/view/demo-careercompass-mixed-006',
                'essential' => ['React', 'JavaScript', 'TypeScript', 'HTML', 'CSS', 'REST API', 'Git'],
                'important' => ['Tailwind CSS', 'Bootstrap', 'Responsive UI', 'Vite', 'Problem Solving', 'Teamwork'],
                'nice_to_have' => ['Laravel', 'API Authentication', 'Unit Testing', 'UI/UX', 'Presentation Skills'],
            ],
            [
                'family' => 'support',
                'title' => 'Laravel + Inertia.js Developer',
                'company' => 'PortalWorks',
                'focus' => 'single-page business portals using Laravel, Inertia.js, and Vue.js',
                'location' => 'Giza, Egypt',
                'salary_range' => '19,000 - 31,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '2-4 years',
                'work_type' => 'Hybrid',
                'source' => 'Wuzzuf Egypt',
                'url' => 'https://wuzzuf.net/jobs/demo-careercompass-mixed-007',
                'essential' => ['PHP', 'Laravel', 'Inertia.js', 'Vue.js', 'JavaScript', 'MySQL', 'Git'],
                'important' => ['REST API', 'Eloquent ORM', 'Tailwind CSS', 'Docker', 'Feature Testing', 'Communication'],
                'nice_to_have' => ['Redis', 'Queues', 'CI/CD', 'Clean Architecture', 'Design Patterns'],
            ],
            [
                'family' => 'support',
                'title' => 'Technical Support Engineer - API Integrations',
                'company' => 'HelpStack MENA',
                'focus' => 'customer API troubleshooting, integration logs, and Laravel support tooling',
                'location' => 'Remote',
                'salary_range' => '900 - 1,500 USD',
                'job_type' => 'Full-time',
                'experience' => '1-3 years',
                'work_type' => 'Remote',
                'source' => 'Arbeitnow Job Board',
                'url' => 'https://www.arbeitnow.com/jobs/demo-careercompass-mixed-008',
                'essential' => ['REST API', 'API Authentication', 'Communication', 'Problem Solving', 'Git', 'MySQL'],
                'important' => ['Laravel', 'PHP', 'Postman', 'Attention to Detail', 'Time Management', 'Linux'],
                'nice_to_have' => ['Docker', 'Redis', 'Presentation Skills', 'Learning Agility', 'Teamwork'],
            ],
            [
                'family' => 'support',
                'title' => 'Software Engineer - PHP/Flutter Internal Tools',
                'company' => 'OmniTools Egypt',
                'focus' => 'internal Laravel tools, small Flutter utilities, and API integrations for operations teams',
                'location' => 'Smart Village, Egypt',
                'salary_range' => '20,000 - 32,000 EGP',
                'job_type' => 'Full-time',
                'experience' => '2-4 years',
                'work_type' => 'Hybrid',
                'source' => 'CareerCompass Demo Jobs',
                'url' => 'https://careercompass.test/jobs/demo-careercompass-mixed-009',
                'essential' => ['PHP', 'Laravel', 'Flutter', 'Dart', 'REST API', 'MySQL', 'Git'],
                'important' => ['Docker', 'Firebase', 'Eloquent ORM', 'Responsive UI', 'Feature Testing', 'Problem Solving'],
                'nice_to_have' => ['Redis', 'Queues', 'App Deployment', 'CI/CD', 'Clean Architecture'],
            ],
            [
                'family' => 'support',
                'title' => 'Cloud Engineer for PHP Platforms',
                'company' => 'CloudOps Arabia',
                'focus' => 'cloud infrastructure for Laravel platforms, queue workers, backups, and release automation',
                'location' => 'Remote',
                'salary_range' => '1,700 - 2,800 USD',
                'job_type' => 'Full-time',
                'experience' => '4+ years',
                'work_type' => 'Remote',
                'source' => 'RemoteOK Remote Jobs',
                'url' => 'https://remoteok.com/remote-jobs/demo-careercompass-mixed-010',
                'essential' => ['AWS', 'Linux', 'Docker', 'Nginx', 'CI/CD', 'MySQL', 'Git'],
                'important' => ['Laravel', 'PHP', 'Redis', 'Queues', 'Docker Compose', 'Problem Solving'],
                'nice_to_have' => ['Kubernetes', 'Terraform', 'DigitalOcean', 'Monitoring', 'Communication'],
            ],
        ];
    }
}
