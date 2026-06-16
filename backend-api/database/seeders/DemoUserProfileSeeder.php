<?php

namespace Database\Seeders;

use App\Models\CvAnalysis;
use App\Models\Job;
use App\Models\Skill;
use App\Models\User;
use App\Models\UserExperience;
use App\Models\UserProfile;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class DemoUserProfileSeeder extends Seeder
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
        if (!Schema::hasTable('users')) {
            $this->command->warn('Skipping DemoUserProfileSeeder: users table does not exist.');
            return;
        }

        DB::transaction(function (): void {
            foreach ($this->demoUsers() as $index => $demoUser) {
                $user = User::updateOrCreate(
                    ['email' => $demoUser['email']],
                    [
                        'name' => $demoUser['name'],
                        'email' => $demoUser['email'],
                        'password' => Hash::make('password'),
                        'role' => 'user',
                    ]
                );

                $forceFill = [];
                if (Schema::hasColumn('users', 'email_verified_at')) {
                    $forceFill['email_verified_at'] = Carbon::now()->subDays(20 - $index);
                }
                if (Schema::hasColumn('users', 'is_banned')) {
                    $forceFill['is_banned'] = false;
                }
                if (!empty($forceFill)) {
                    $user->forceFill($forceFill)->save();
                }

                $this->seedProfile($user, $demoUser);
                $this->seedExperiences($user, $demoUser);
                $this->seedSkills($user, $demoUser);
                $this->seedCvAnalysis($user, $demoUser, $index);
                $this->seedApplications($user, $demoUser, $index);
            }
        });

        $this->command->info('Seeded/updated 5 demo users with profiles, skills, experiences, CV analyses, and tracker data.');
    }

    private function seedProfile(User $user, array $demoUser): void
    {
        if (!Schema::hasTable('user_profiles')) {
            return;
        }

        UserProfile::updateOrCreate(
            ['user_id' => $user->id],
            $this->filterColumns('user_profiles', [
                'headline' => $demoUser['headline'],
                'summary' => $demoUser['summary'],
                'location' => $demoUser['location'],
                'total_experience_years' => $demoUser['total_experience_years'],
                'seniority' => $demoUser['seniority'],
                'primary_domain' => $demoUser['primary_domain'],
                'contact_info' => $demoUser['contact_info'],
            ])
        );
    }

    private function seedExperiences(User $user, array $demoUser): void
    {
        if (!Schema::hasTable('user_experiences')) {
            return;
        }

        foreach ($demoUser['experiences'] as $experience) {
            UserExperience::updateOrCreate(
                [
                    'user_id' => $user->id,
                    'title' => $experience['title'],
                    'company' => $experience['company'],
                ],
                $this->filterColumns('user_experiences', [
                    'location' => $experience['location'],
                    'start_date' => $experience['start_date'],
                    'end_date' => $experience['end_date'],
                    'is_current' => $experience['is_current'],
                    'description' => $experience['description'],
                    'technologies' => $experience['technologies'],
                ])
            );
        }
    }

    private function seedSkills(User $user, array $demoUser): void
    {
        if (!Schema::hasTable('skills') || !Schema::hasTable('user_skills')) {
            return;
        }

        foreach ($demoUser['skills'] as $skillData) {
            $skill = Skill::firstOrCreate(
                ['name' => $skillData['name']],
                ['type' => $this->skillType($skillData['name'])]
            );

            DB::table('user_skills')->updateOrInsert(
                [
                    'user_id' => $user->id,
                    'skill_id' => $skill->id,
                ],
                $this->filterColumns('user_skills', [
                    'confidence_score' => $skillData['confidence_score'],
                    'evidence' => $skillData['evidence'],
                    'created_at' => Carbon::now()->subDays(12),
                    'updated_at' => Carbon::now(),
                ])
            );
        }
    }

    private function seedCvAnalysis(User $user, array $demoUser, int $index): void
    {
        if (!Schema::hasTable('cv_analyses')) {
            return;
        }

        $skillNames = array_column($demoUser['skills'], 'name');
        $metadata = [
            'extracted_skills' => $skillNames,
            'top_skills_by_years' => $this->topSkillsByYears($demoUser['skill_durations']),
            'skill_durations' => $demoUser['skill_durations'],
            'education' => $demoUser['education'],
            'projects' => $demoUser['projects'],
            'languages' => $demoUser['languages'],
            'preferred_locations' => $demoUser['preferred_locations'],
            'target_roles' => [$demoUser['target_role']],
        ];

        $analysis = [
            'parsing_status' => 'completed',
            'seniority' => $demoUser['seniority'],
            'predicted_role' => $demoUser['target_role'],
            'primary_domain' => $demoUser['primary_domain'],
            'confidence_score' => $demoUser['confidence_score'],
            'summary' => $demoUser['cv_summary'],
            'completeness_score' => $demoUser['completeness_score'],
            'strengths' => $demoUser['strengths'],
            'gaps' => $demoUser['gaps'],
            'red_flags' => $demoUser['red_flags'],
            'metadata' => $metadata,
            'raw_json_output' => [
                'role' => $demoUser['target_role'],
                'seniority' => $demoUser['seniority'],
                'skills' => $skillNames,
                'experiences' => array_map(
                    fn (array $experience): array => [
                        'title' => $experience['title'],
                        'company' => $experience['company'],
                        'technologies' => $experience['technologies'],
                    ],
                    $demoUser['experiences']
                ),
                'education' => $demoUser['education'],
                'projects' => $demoUser['projects'],
            ],
        ];

        $storageMetadata = [
            'cv_disk' => 'local',
            'cv_path' => 'demo-cvs/' . $demoUser['email'] . '.pdf',
            'cv_original_name' => str_replace(' ', '_', $demoUser['name']) . '_CV.pdf',
            'cv_mime' => 'application/pdf',
            'cv_size' => 240000 + ($index * 37500),
            'cv_sha256' => hash('sha256', $demoUser['email'] . '-careercompass-demo-cv'),
            'cv_uploaded_at' => Carbon::now()->subDays(8 - $index)->setTime(11 + $index, 15),
        ];

        foreach ($storageMetadata as $column => $value) {
            if (Schema::hasColumn('cv_analyses', $column)) {
                $analysis[$column] = $value;
            }
        }

        CvAnalysis::updateOrCreate(
            ['user_id' => $user->id],
            $this->filterColumns('cv_analyses', $analysis)
        );
    }

    private function seedApplications(User $user, array $demoUser, int $userIndex): void
    {
        if (!Schema::hasTable('applications') || !Schema::hasTable('job_postings')) {
            return;
        }

        foreach ($demoUser['applications'] as $index => $applicationData) {
            $job = $this->findJob($applicationData['job_title'], $applicationData['source']);

            if (!$job) {
                $this->command->warn("Skipping demo application for {$user->email}: job not found ({$applicationData['job_title']}).");
                continue;
            }

            $status = $applicationData['status'];
            $appliedAt = in_array($status, ['applied', 'interviewing', 'offered', 'rejected'], true)
                ? Carbon::now()->subDays(3 + $index + ($userIndex * 2))->setTime(10 + $index, 30)
                : null;

            DB::table('applications')->updateOrInsert(
                [
                    'user_id' => $user->id,
                    'job_id' => $job->id,
                ],
                $this->filterColumns('applications', [
                    'status' => $status,
                    'notes' => $applicationData['notes'],
                    'applied_at' => $appliedAt,
                    'created_at' => Carbon::now()->subDays(10 + $index + $userIndex),
                    'updated_at' => Carbon::now()->subDays($index),
                ])
            );
        }
    }

    private function findJob(string $title, string $source): ?Job
    {
        $normalizedTitle = mb_strtolower($title);

        return Job::query()
            ->where('source', $source)
            ->whereRaw('LOWER(title) = ?', [$normalizedTitle])
            ->first()
            ?: Job::query()
                ->whereRaw('LOWER(title) = ?', [$normalizedTitle])
                ->first();
    }

    private function filterColumns(string $table, array $attributes): array
    {
        return array_filter(
            $attributes,
            fn ($value, string $column): bool => Schema::hasColumn($table, $column),
            ARRAY_FILTER_USE_BOTH
        );
    }

    private function skillType(string $skillName): string
    {
        return in_array($skillName, $this->softSkills, true) ? 'soft' : 'technical';
    }

    private function topSkillsByYears(array $skillDurations): array
    {
        arsort($skillDurations);

        return array_map(
            fn (string $skill, float|int $years): array => [
                'skill' => $skill,
                'years' => (float) $years,
            ],
            array_keys(array_slice($skillDurations, 0, 5, true)),
            array_values(array_slice($skillDurations, 0, 5, true))
        );
    }

    private function skill(string $name, int $confidenceScore, string $evidence): array
    {
        return [
            'name' => $name,
            'confidence_score' => $confidenceScore,
            'evidence' => $evidence,
        ];
    }

    private function demoUsers(): array
    {
        return [
            [
                'name' => 'Ahmed Hassan',
                'email' => 'ahmed.backend.demo@careercompass.test',
                'target_role' => 'Backend Laravel Developer',
                'headline' => 'Junior Backend Laravel Developer',
                'summary' => 'Junior backend developer focused on Laravel REST APIs, authentication, dashboards, MySQL schemas, Git collaboration, and Docker basics. Ahmed has built graduation and freelance-style projects with clear controllers, validation, and simple deployment workflows.',
                'cv_summary' => 'The CV shows a junior Laravel backend profile with practical API, authentication, dashboard, MySQL, Git, and Docker exposure. The candidate is ready for junior backend roles and should deepen Redis, queues, automated testing, AWS, and CI/CD to compete for stronger backend positions.',
                'location' => 'Cairo, Egypt',
                'total_experience_years' => 1.5,
                'seniority' => 'junior',
                'primary_domain' => 'Backend Development',
                'confidence_score' => 0.86,
                'completeness_score' => 82,
                'contact_info' => [
                    'phone' => '+20 100 555 0101',
                    'linkedin_url' => 'https://linkedin.com/in/ahmed-hassan-careercompass-demo',
                    'github_url' => 'https://github.com/ahmed-careercompass-demo',
                    'portfolio_url' => 'https://ahmed-demo.careercompass.test',
                ],
                'skills' => [
                    $this->skill('PHP', 84, 'Mentioned in work experience'),
                    $this->skill('Laravel', 86, 'Extracted from CV project section'),
                    $this->skill('MySQL', 82, 'Mentioned in work experience'),
                    $this->skill('REST API', 83, 'Extracted from CV project section'),
                    $this->skill('Git', 80, 'Detected from GitHub project summary'),
                    $this->skill('HTML', 75, 'Detected from portfolio project'),
                    $this->skill('CSS', 73, 'Detected from portfolio project'),
                    $this->skill('JavaScript', 72, 'Detected from GitHub project summary'),
                    $this->skill('Docker', 68, 'Mentioned in local setup notes'),
                    $this->skill('JWT', 77, 'Extracted from authentication project'),
                    $this->skill('MVC', 81, 'Mentioned in Laravel project structure'),
                    $this->skill('Problem Solving', 88, 'Mentioned in CV summary'),
                    $this->skill('Communication', 79, 'Mentioned in teamwork experience'),
                ],
                'skill_durations' => [
                    'PHP' => 1.5,
                    'Laravel' => 1.3,
                    'MySQL' => 1.2,
                    'REST API' => 1.1,
                    'Git' => 1.4,
                    'Docker' => 0.4,
                ],
                'strengths' => [
                    'Solid Laravel MVC foundation',
                    'Good REST API and authentication project evidence',
                    'Comfortable with MySQL schema design',
                    'Uses Git and GitHub consistently',
                    'Clear junior-level backend learning direction',
                ],
                'gaps' => ['Redis', 'Queues', 'Testing', 'AWS', 'CI/CD'],
                'red_flags' => ['No production deployment link provided'],
                'education' => [
                    'degree' => 'BSc Computer Science',
                    'institution' => 'Cairo University',
                    'graduation_year' => 2026,
                ],
                'projects' => [
                    'CareerCompass API clone with Laravel authentication',
                    'Inventory dashboard with MySQL reporting',
                    'Simple JWT-based task management API',
                ],
                'languages' => ['Arabic: native', 'English: good professional'],
                'preferred_locations' => ['Cairo', 'Giza', 'Hybrid - Cairo, Egypt', 'Remote'],
                'experiences' => [
                    [
                        'title' => 'Backend Laravel Intern',
                        'company' => 'Nile Academy Projects',
                        'location' => 'Cairo, Egypt',
                        'start_date' => '2024-07-01',
                        'end_date' => '2024-10-31',
                        'is_current' => false,
                        'description' => 'Built Laravel controllers, request validation, MySQL tables, and JWT-protected endpoints for student project modules.',
                        'technologies' => ['PHP', 'Laravel', 'MySQL', 'JWT', 'Git'],
                    ],
                    [
                        'title' => 'Junior Backend Developer',
                        'company' => 'Freelance Graduation Projects',
                        'location' => 'Remote',
                        'start_date' => '2024-11-01',
                        'end_date' => null,
                        'is_current' => true,
                        'description' => 'Implemented REST APIs, admin dashboard screens, Docker-based local setup, and GitHub issue tracking for small client-style systems.',
                        'technologies' => ['Laravel', 'REST API', 'Docker', 'Git', 'JavaScript'],
                    ],
                ],
                'applications' => [
                    ['job_title' => 'Junior Backend Laravel Developer', 'source' => 'Wuzzuf Egypt', 'status' => 'applied', 'notes' => 'Strong match because Laravel, MySQL, REST API, and Git are already present; needs Redis and queues.'],
                    ['job_title' => 'Backend Laravel Developer', 'source' => 'LinkedIn Global', 'status' => 'saved', 'notes' => 'Good target role for the defense demo; Docker is present but testing and CI/CD need work.'],
                    ['job_title' => 'PHP Laravel Developer', 'source' => 'Wuzzuf Egypt', 'status' => 'interviewing', 'notes' => 'Matches PHP and Laravel fundamentals; Livewire and unit testing are the main gaps.'],
                    ['job_title' => 'Laravel API Developer', 'source' => 'Remotive Remote Jobs', 'status' => 'rejected', 'notes' => 'Rejected after screening because the role expected stronger Redis, queues, and cloud deployment experience.'],
                    ['job_title' => 'Backend API Developer (Laravel)', 'source' => 'Wuzzuf Egypt', 'status' => 'archived', 'notes' => 'Archived as a future option after practicing API authentication and feature tests.'],
                    ['job_title' => 'Junior PHP Laravel Developer', 'source' => 'Wuzzuf Egypt', 'status' => 'saved', 'notes' => 'Very realistic junior option with HTML, CSS, PHP, Laravel, and communication overlap.'],
                ],
            ],
            [
                'name' => 'Youssef Ali',
                'email' => 'youssef.laravel.demo@careercompass.test',
                'target_role' => 'Mid-level Laravel Developer',
                'headline' => 'Mid-level PHP Laravel Backend Developer',
                'summary' => 'Backend developer with strong Laravel API experience, queues, Redis caching, Sanctum authentication, payment integration, and PHPUnit coverage. Youssef has worked on fintech-style modules and production support tasks.',
                'cv_summary' => 'The CV indicates a mid-level Laravel backend developer with strong API design, Redis, queue, testing, and payment integration experience. The candidate is a strong fit for Laravel API and integration roles, with room to improve AWS depth and microservice design.',
                'location' => 'Giza, Egypt',
                'total_experience_years' => 3.2,
                'seniority' => 'mid',
                'primary_domain' => 'Backend Development',
                'confidence_score' => 0.93,
                'completeness_score' => 91,
                'contact_info' => [
                    'phone' => '+20 111 555 0202',
                    'linkedin_url' => 'https://linkedin.com/in/youssef-ali-careercompass-demo',
                    'github_url' => 'https://github.com/youssef-laravel-demo',
                    'portfolio_url' => 'https://youssef-demo.careercompass.test',
                ],
                'skills' => [
                    $this->skill('PHP', 91, 'Mentioned in work experience'),
                    $this->skill('Laravel', 94, 'Mentioned in work experience'),
                    $this->skill('MySQL', 90, 'Mentioned in database project'),
                    $this->skill('PostgreSQL', 78, 'Extracted from API project section'),
                    $this->skill('Redis', 84, 'Mentioned in production caching task'),
                    $this->skill('REST API', 92, 'Mentioned in work experience'),
                    $this->skill('Sanctum', 85, 'Extracted from authentication project'),
                    $this->skill('Docker', 80, 'Mentioned in deployment notes'),
                    $this->skill('Git', 88, 'Detected from GitHub project summary'),
                    $this->skill('PHPUnit', 82, 'Mentioned in testing section'),
                    $this->skill('Queues', 83, 'Mentioned in background jobs section'),
                    $this->skill('Clean Architecture', 76, 'Mentioned in project architecture notes'),
                    $this->skill('SOLID Principles', 79, 'Mentioned in CV summary'),
                ],
                'skill_durations' => [
                    'PHP' => 3.2,
                    'Laravel' => 3.0,
                    'MySQL' => 2.8,
                    'REST API' => 2.7,
                    'Redis' => 1.4,
                    'Queues' => 1.3,
                    'PHPUnit' => 1.1,
                ],
                'strengths' => [
                    'Strong Laravel and REST API experience',
                    'Practical Redis and queue exposure',
                    'Testing experience with PHPUnit',
                    'Good authentication and payment integration background',
                    'Clear backend production support evidence',
                ],
                'gaps' => ['AWS depth', 'Kubernetes', 'Advanced observability', 'Microservices at scale'],
                'red_flags' => [],
                'education' => [
                    'degree' => 'BSc Information Systems',
                    'institution' => 'Ain Shams University',
                    'graduation_year' => 2023,
                ],
                'projects' => [
                    'Merchant payment callback processor',
                    'Laravel queue worker for invoice notifications',
                    'API test suite for ecommerce checkout',
                ],
                'languages' => ['Arabic: native', 'English: very good professional'],
                'preferred_locations' => ['Giza', 'Smart Village', 'Hybrid - Cairo, Egypt', 'Remote'],
                'experiences' => [
                    [
                        'title' => 'PHP Laravel Developer',
                        'company' => 'Fintech Sprint Egypt',
                        'location' => 'Giza, Egypt',
                        'start_date' => '2022-10-01',
                        'end_date' => '2024-02-29',
                        'is_current' => false,
                        'description' => 'Built merchant APIs, Sanctum authentication, payment callbacks, Redis cache layers, and PHPUnit feature tests.',
                        'technologies' => ['PHP', 'Laravel', 'Sanctum', 'Redis', 'PHPUnit'],
                    ],
                    [
                        'title' => 'Backend Laravel Developer',
                        'company' => 'PayFlow Labs',
                        'location' => 'Hybrid - Cairo, Egypt',
                        'start_date' => '2024-03-01',
                        'end_date' => null,
                        'is_current' => true,
                        'description' => 'Owns Laravel queue workers, API integrations, MySQL/PostgreSQL reporting tables, Docker setup, and release support.',
                        'technologies' => ['Laravel', 'MySQL', 'PostgreSQL', 'Queues', 'Docker'],
                    ],
                ],
                'applications' => [
                    ['job_title' => 'Mid-Level Laravel Backend Engineer', 'source' => 'CareerCompass Demo Jobs', 'status' => 'applied', 'notes' => 'Excellent match for mid-level Laravel, Redis, queues, and testing experience.'],
                    ['job_title' => 'Senior Laravel Developer', 'source' => 'LinkedIn Global', 'status' => 'interviewing', 'notes' => 'Strong technical overlap, but senior scope may require more architecture leadership evidence.'],
                    ['job_title' => 'Laravel API Engineer', 'source' => 'Remotive Remote Jobs', 'status' => 'saved', 'notes' => 'Remote role aligns well with API, PostgreSQL, Redis, and queues.'],
                    ['job_title' => 'Senior PHP Laravel API Developer', 'source' => 'Remotive Remote Jobs', 'status' => 'rejected', 'notes' => 'Role required deeper AWS and microservices at scale than current CV shows.'],
                    ['job_title' => 'Laravel Developer (Queues & Redis)', 'source' => 'Wuzzuf Egypt', 'status' => 'applied', 'notes' => 'Very strong match because Redis, queues, PHPUnit, and Docker are present.'],
                    ['job_title' => 'Laravel Integration Developer', 'source' => 'LinkedIn Global', 'status' => 'saved', 'notes' => 'Good target for payment integration experience; OAuth2 should be refreshed before applying.'],
                ],
            ],
            [
                'name' => 'Sara Mohamed',
                'email' => 'sara.flutter.demo@careercompass.test',
                'target_role' => 'Flutter Developer',
                'headline' => 'Flutter Mobile Developer',
                'summary' => 'Flutter developer building responsive mobile apps with Firebase, REST APIs, Dio, Provider, Bloc, and Android release basics. Sara is comfortable turning UI requirements into reusable widgets and integrating backend APIs.',
                'cv_summary' => 'The CV shows a Flutter mobile developer with solid Dart, Firebase, REST API, state management, and responsive UI experience. Sara is ready for junior-to-mid Flutter roles and should add iOS deployment, Riverpod, Clean Architecture, and automated tests.',
                'location' => 'New Cairo, Egypt',
                'total_experience_years' => 2.0,
                'seniority' => 'mid',
                'primary_domain' => 'Mobile Development',
                'confidence_score' => 0.9,
                'completeness_score' => 88,
                'contact_info' => [
                    'phone' => '+20 122 555 0303',
                    'linkedin_url' => 'https://linkedin.com/in/sara-mohamed-careercompass-demo',
                    'github_url' => 'https://github.com/sara-flutter-demo',
                    'portfolio_url' => 'https://sara-demo.careercompass.test',
                ],
                'skills' => [
                    $this->skill('Dart', 88, 'Mentioned in work experience'),
                    $this->skill('Flutter', 91, 'Mentioned in work experience'),
                    $this->skill('Firebase', 84, 'Extracted from CV project section'),
                    $this->skill('REST APIs', 86, 'Mentioned in API integration work'),
                    $this->skill('Dio', 82, 'Detected from GitHub project summary'),
                    $this->skill('Provider', 81, 'Mentioned in state management section'),
                    $this->skill('Bloc', 76, 'Detected from mobile project summary'),
                    $this->skill('Android', 79, 'Mentioned in release notes'),
                    $this->skill('Git', 83, 'Detected from GitHub activity'),
                    $this->skill('Responsive UI', 87, 'Mentioned in portfolio projects'),
                    $this->skill('Problem Solving', 86, 'Mentioned in CV summary'),
                ],
                'skill_durations' => [
                    'Flutter' => 2.0,
                    'Dart' => 2.0,
                    'Firebase' => 1.4,
                    'REST APIs' => 1.5,
                    'Provider' => 1.2,
                    'Bloc' => 0.8,
                ],
                'strengths' => [
                    'Strong Flutter and Dart foundation',
                    'Good Firebase and REST API integration evidence',
                    'Responsive UI implementation experience',
                    'Uses Provider and Bloc for state management',
                    'Practical Android release awareness',
                ],
                'gaps' => ['iOS deployment', 'Riverpod', 'Clean Architecture', 'Unit Testing'],
                'red_flags' => ['Limited automated test evidence'],
                'education' => [
                    'degree' => 'BSc Computer Engineering',
                    'institution' => 'Helwan University',
                    'graduation_year' => 2024,
                ],
                'projects' => [
                    'Flutter ecommerce catalog with Firebase Auth',
                    'Restaurant ordering app with Dio API integration',
                    'Responsive event booking mobile UI',
                ],
                'languages' => ['Arabic: native', 'English: good professional'],
                'preferred_locations' => ['New Cairo', 'Cairo', 'Hybrid - Cairo, Egypt', 'Remote'],
                'experiences' => [
                    [
                        'title' => 'Flutter Developer',
                        'company' => 'Mobile Sprint Studio',
                        'location' => 'New Cairo, Egypt',
                        'start_date' => '2023-08-01',
                        'end_date' => '2024-07-31',
                        'is_current' => false,
                        'description' => 'Built Flutter screens, integrated REST APIs using Dio, handled Provider state, and implemented Firebase authentication flows.',
                        'technologies' => ['Dart', 'Flutter', 'Dio', 'Provider', 'Firebase'],
                    ],
                    [
                        'title' => 'Mobile App Developer',
                        'company' => 'AppWorks MENA',
                        'location' => 'Hybrid - Cairo, Egypt',
                        'start_date' => '2024-08-01',
                        'end_date' => null,
                        'is_current' => true,
                        'description' => 'Develops responsive Flutter features, Android builds, push notifications, and Bloc-based screens for customer-facing apps.',
                        'technologies' => ['Flutter', 'Bloc', 'REST APIs', 'Android', 'Push Notifications'],
                    ],
                ],
                'applications' => [
                    ['job_title' => 'Flutter Developer - Food Delivery App', 'source' => 'LinkedIn Global', 'status' => 'applied', 'notes' => 'Flutter role matches current skills but requires stronger delivery-tracking and release experience.'],
                    ['job_title' => 'Flutter Firebase Developer', 'source' => 'Wuzzuf Egypt', 'status' => 'saved', 'notes' => 'Very good match because Firebase, REST APIs, Provider, and Git are present.'],
                    ['job_title' => 'Mobile App Developer Flutter', 'source' => 'CareerCompass Demo Jobs', 'status' => 'interviewing', 'notes' => 'Strong match with Flutter, Firebase Auth, Bloc, and responsive UI.'],
                    ['job_title' => 'Mid-Level Flutter Developer', 'source' => 'Remotive Remote Jobs', 'status' => 'rejected', 'notes' => 'Rejected because the role expected iOS deployment and Riverpod depth.'],
                    ['job_title' => 'Flutter Developer (Firebase & Push Notifications)', 'source' => 'RemoteOK Remote Jobs', 'status' => 'applied', 'notes' => 'Good match for Firebase and push notifications; Riverpod remains a gap.'],
                    ['job_title' => 'Flutter Clean Architecture Developer', 'source' => 'Remotive Remote Jobs', 'status' => 'saved', 'notes' => 'Aspirational role for improving Clean Architecture and unit testing.'],
                ],
            ],
            [
                'name' => 'Mariam Adel',
                'email' => 'mariam.mobile.demo@careercompass.test',
                'target_role' => 'Junior Flutter Developer',
                'headline' => 'Junior Flutter Developer',
                'summary' => 'Junior mobile developer with hands-on Flutter screens, Firebase Auth, Firestore data reads, REST API integration, Git basics, and careful UI implementation. Mariam is strongest in junior mobile roles with mentorship.',
                'cv_summary' => 'The CV reflects a junior Flutter candidate with practical UI, Firebase Auth, Firestore, REST API, and Git exposure. The profile is suitable for junior Flutter roles and needs state management depth, Android release practice, testing, and Clean Architecture.',
                'location' => 'Mansoura, Egypt',
                'total_experience_years' => 0.9,
                'seniority' => 'junior',
                'primary_domain' => 'Mobile Development',
                'confidence_score' => 0.82,
                'completeness_score' => 78,
                'contact_info' => [
                    'phone' => '+20 109 555 0404',
                    'linkedin_url' => 'https://linkedin.com/in/mariam-adel-careercompass-demo',
                    'github_url' => 'https://github.com/mariam-flutter-demo',
                    'portfolio_url' => 'https://mariam-demo.careercompass.test',
                ],
                'skills' => [
                    $this->skill('Dart', 77, 'Extracted from CV project section'),
                    $this->skill('Flutter', 80, 'Extracted from CV project section'),
                    $this->skill('Firebase Auth', 74, 'Mentioned in mobile auth project'),
                    $this->skill('Firestore', 71, 'Mentioned in Firebase project'),
                    $this->skill('REST APIs', 69, 'Detected from API integration task'),
                    $this->skill('Git', 70, 'Detected from GitHub project summary'),
                    $this->skill('UI/UX basics', 68, 'Mentioned in UI implementation section'),
                ],
                'skill_durations' => [
                    'Flutter' => 0.9,
                    'Dart' => 0.9,
                    'Firebase Auth' => 0.6,
                    'Firestore' => 0.5,
                    'REST APIs' => 0.4,
                ],
                'strengths' => [
                    'Good junior Flutter UI implementation',
                    'Hands-on Firebase Auth and Firestore practice',
                    'Has API integration project evidence',
                    'Maintains simple GitHub project history',
                ],
                'gaps' => ['State Management', 'Bloc', 'Riverpod', 'Android deployment', 'Unit Testing', 'Clean Architecture'],
                'red_flags' => ['Limited work experience', 'No production deployment link provided'],
                'education' => [
                    'degree' => 'BSc Computer Science',
                    'institution' => 'Mansoura University',
                    'graduation_year' => 2026,
                ],
                'projects' => [
                    'Flutter notes app with Firebase Auth',
                    'Firestore-based task tracker',
                    'Weather mobile UI consuming a REST API',
                ],
                'languages' => ['Arabic: native', 'English: good'],
                'preferred_locations' => ['Mansoura', 'Alexandria', 'Remote', 'Hybrid - Cairo, Egypt'],
                'experiences' => [
                    [
                        'title' => 'Flutter Trainee',
                        'company' => 'Mansoura Mobile Circle',
                        'location' => 'Mansoura, Egypt',
                        'start_date' => '2025-02-01',
                        'end_date' => '2025-05-31',
                        'is_current' => false,
                        'description' => 'Practiced Flutter UI implementation, Firebase Auth, Firestore reads, and Git-based project submission.',
                        'technologies' => ['Dart', 'Flutter', 'Firebase Auth', 'Firestore', 'Git'],
                    ],
                    [
                        'title' => 'Junior Flutter Freelancer',
                        'company' => 'Student App Projects',
                        'location' => 'Remote',
                        'start_date' => '2025-06-01',
                        'end_date' => null,
                        'is_current' => true,
                        'description' => 'Builds small mobile screens, connects REST APIs, fixes UI bugs, and prepares simple demo builds for clients.',
                        'technologies' => ['Flutter', 'REST APIs', 'UI/UX basics', 'Git'],
                    ],
                ],
                'applications' => [
                    ['job_title' => 'Junior Flutter Developer', 'source' => 'Wuzzuf Egypt', 'status' => 'applied', 'notes' => 'Best junior match; current Flutter, Firebase Auth, Firestore, and Git skills cover the basics.'],
                    ['job_title' => 'Junior Mobile Developer Flutter', 'source' => 'Wuzzuf Egypt', 'status' => 'interviewing', 'notes' => 'Very realistic junior opportunity with Firebase Auth, REST APIs, and UI implementation overlap.'],
                    ['job_title' => 'Flutter UI Developer', 'source' => 'Wuzzuf Egypt', 'status' => 'saved', 'notes' => 'Good UI-focused option; Provider and Dio are missing but learnable.'],
                    ['job_title' => 'Flutter Firebase Developer', 'source' => 'Wuzzuf Egypt', 'status' => 'applied', 'notes' => 'Matches Firebase Auth and Firestore but requires stronger state management.'],
                    ['job_title' => 'Mobile App Developer Flutter', 'source' => 'CareerCompass Demo Jobs', 'status' => 'rejected', 'notes' => 'Rejected because the role expected more production mobile experience and Bloc.'],
                    ['job_title' => 'Flutter Developer for E-commerce App', 'source' => 'CareerCompass Demo Jobs', 'status' => 'archived', 'notes' => 'Archived until API integration and app deployment skills are stronger.'],
                ],
            ],
            [
                'name' => 'Omar Khaled',
                'email' => 'omar.fullstack.demo@careercompass.test',
                'target_role' => 'Full Stack Laravel Developer',
                'headline' => 'Full Stack Laravel Developer',
                'summary' => 'Full stack Laravel developer with Vue/React frontend work, admin dashboards, REST API integrations, MySQL schemas, Docker local setup, and Tailwind/Bootstrap UI delivery. Omar is strongest in product teams that need backend plus dashboard features.',
                'cv_summary' => 'The CV presents a mid-level full stack Laravel developer with useful backend, Vue/React, API, MySQL, Docker, and dashboard experience. Omar is a good match for full stack Laravel roles and should improve testing, Redis queues, Inertia.js, and deployment automation.',
                'location' => 'Alexandria, Egypt',
                'total_experience_years' => 2.5,
                'seniority' => 'mid',
                'primary_domain' => 'Backend Development',
                'confidence_score' => 0.88,
                'completeness_score' => 87,
                'contact_info' => [
                    'phone' => '+20 115 555 0505',
                    'linkedin_url' => 'https://linkedin.com/in/omar-khaled-careercompass-demo',
                    'github_url' => 'https://github.com/omar-fullstack-demo',
                    'portfolio_url' => 'https://omar-demo.careercompass.test',
                ],
                'skills' => [
                    $this->skill('PHP', 86, 'Mentioned in work experience'),
                    $this->skill('Laravel', 88, 'Mentioned in work experience'),
                    $this->skill('MySQL', 84, 'Mentioned in dashboard project'),
                    $this->skill('Vue.js', 78, 'Detected from GitHub project summary'),
                    $this->skill('React', 74, 'Mentioned in frontend project'),
                    $this->skill('JavaScript', 83, 'Mentioned in work experience'),
                    $this->skill('REST API', 85, 'Extracted from API integration project'),
                    $this->skill('Git', 82, 'Detected from GitHub activity'),
                    $this->skill('Docker', 72, 'Mentioned in local setup notes'),
                    $this->skill('Tailwind CSS', 79, 'Mentioned in UI project'),
                    $this->skill('Bootstrap', 76, 'Mentioned in admin dashboard project'),
                ],
                'skill_durations' => [
                    'Laravel' => 2.4,
                    'PHP' => 2.5,
                    'MySQL' => 2.2,
                    'JavaScript' => 2.1,
                    'Vue.js' => 1.3,
                    'React' => 0.8,
                ],
                'strengths' => [
                    'Balanced Laravel backend and frontend dashboard skills',
                    'Good REST API and MySQL integration evidence',
                    'Practical Vue.js and React exposure',
                    'Uses Docker and Git in project workflows',
                    'Comfortable with Tailwind and Bootstrap UI delivery',
                ],
                'gaps' => ['Feature Testing', 'Redis', 'Queues', 'Inertia.js', 'CI/CD'],
                'red_flags' => ['Testing evidence is lighter than backend/frontend project evidence'],
                'education' => [
                    'degree' => 'BSc Software Engineering',
                    'institution' => 'Alexandria University',
                    'graduation_year' => 2024,
                ],
                'projects' => [
                    'Laravel CRM dashboard with Vue.js',
                    'React admin analytics screen consuming Laravel APIs',
                    'Inventory portal with Bootstrap and MySQL reports',
                ],
                'languages' => ['Arabic: native', 'English: very good'],
                'preferred_locations' => ['Alexandria', 'Cairo', 'Remote', 'Hybrid - Cairo, Egypt'],
                'experiences' => [
                    [
                        'title' => 'Laravel Web Developer',
                        'company' => 'Alex Web Factory',
                        'location' => 'Alexandria, Egypt',
                        'start_date' => '2022-11-01',
                        'end_date' => '2024-01-31',
                        'is_current' => false,
                        'description' => 'Built Laravel admin dashboards, MySQL reporting queries, Bootstrap screens, and REST API integrations for small businesses.',
                        'technologies' => ['PHP', 'Laravel', 'MySQL', 'Bootstrap', 'REST API'],
                    ],
                    [
                        'title' => 'Full Stack Developer',
                        'company' => 'ProductOps Egypt',
                        'location' => 'Remote',
                        'start_date' => '2024-02-01',
                        'end_date' => null,
                        'is_current' => true,
                        'description' => 'Ships Laravel API features, Vue.js dashboard modules, React widgets, Tailwind UI improvements, Docker setup, and GitHub code reviews.',
                        'technologies' => ['Laravel', 'Vue.js', 'React', 'Tailwind CSS', 'Docker'],
                    ],
                ],
                'applications' => [
                    ['job_title' => 'Full Stack Laravel Vue Developer', 'source' => 'Wuzzuf Egypt', 'status' => 'applied', 'notes' => 'Strong match because Laravel, Vue.js, JavaScript, MySQL, REST API, Docker, and Tailwind are present.'],
                    ['job_title' => 'Full Stack Laravel React Developer', 'source' => 'LinkedIn Global', 'status' => 'interviewing', 'notes' => 'Good full stack fit; React is present but could be stronger.'],
                    ['job_title' => 'Laravel + Inertia.js Developer', 'source' => 'Wuzzuf Egypt', 'status' => 'saved', 'notes' => 'Good target after adding Inertia.js practice and stronger feature testing.'],
                    ['job_title' => 'Software Engineer - PHP/Flutter Internal Tools', 'source' => 'CareerCompass Demo Jobs', 'status' => 'applied', 'notes' => 'Backend and dashboard work match well; Flutter is a nice-to-have gap.'],
                    ['job_title' => 'Backend API Developer - Node & Laravel Integrations', 'source' => 'CareerCompass Demo Jobs', 'status' => 'rejected', 'notes' => 'Rejected because Node.js and integration testing depth were limited.'],
                    ['job_title' => 'Frontend React Developer - SaaS Dashboard', 'source' => 'LinkedIn Global', 'status' => 'archived', 'notes' => 'Archived because the role is more frontend-specialized than the target full stack Laravel path.'],
                ],
            ],
        ];
    }
}
