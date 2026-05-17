<?php

namespace Tests\Feature;

use App\Models\Job;
use App\Models\ScrapingSource;
use App\Models\Skill;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ScrapedJobImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_scraper_import_requires_token(): void
    {
        config(['services.scrapy.token' => 'scraper-secret']);

        $this->postJson('/api/jobs/import', [
            'title' => 'Remote PHP Developer',
            'description' => 'Build Laravel APIs for a production product team.',
            'company' => 'Token Test Co',
            'url' => 'https://example.test/jobs/token',
            'source' => 'Remotive',
        ])->assertUnauthorized();
    }

    public function test_scraped_job_import_creates_normalized_relational_skills(): void
    {
        config(['services.scrapy.token' => 'scraper-secret']);

        $source = ScrapingSource::create([
            'name' => 'LinkedIn',
            'endpoint' => 'https://example.test/jobs',
            'type' => 'html',
            'mode' => 'static',
            'status' => 'active',
            'method' => 'GET',
        ]);

        $payload = [
            'title' => 'senior php developer',
            'description' => '<p>Build Laravel APIs safely.</p>',
            'company' => 'Career Compass',
            'url' => 'https://example.test/jobs/1',
            'scraping_source_id' => $source->id,
            'location' => 'Remote',
            'skills' => [
                'php',
                ['name' => 'PHP'],
                ['name' => 'react.js'],
                ['skill' => 'Laravel'],
            ],
            'work_type' => 'remote',
            'source' => 'LinkedIn',
        ];

        $this->withToken('scraper-secret')
            ->postJson('/api/jobs/import', $payload)
            ->assertCreated()
            ->assertJsonStructure(['message', 'job_id']);

        $job = Job::with('requiredSkills')->firstOrFail();

        $this->assertSame('Senior PHP Developer', $job->title);
        $this->assertSame('Build Laravel APIs safely.', $job->description);
        $this->assertEqualsCanonicalizing(
            ['Laravel', 'PHP', 'React'],
            $job->requiredSkills->pluck('name')->all()
        );
        $this->assertSame(3, Skill::count());

        foreach ($job->requiredSkills as $skill) {
            $this->assertDatabaseHas('job_skills', [
                'job_id' => $job->id,
                'skill_id' => $skill->id,
            ]);
        }
    }

    public function test_scraped_job_import_check_is_internal_only(): void
    {
        config(['services.scrapy.token' => 'scraper-secret']);

        $this->postJson('/api/jobs/import/check', [
            'url' => 'https://example.test/jobs/1',
        ])->assertUnauthorized();

        $this->withToken('scraper-secret')
            ->postJson('/api/jobs/import/check', [
                'url' => 'https://example.test/jobs/1',
            ])
            ->assertOk()
            ->assertJsonPath('exists', false);
    }

    public function test_invalid_external_url_is_rejected(): void
    {
        config(['services.scrapy.token' => 'scraper-secret']);

        $source = ScrapingSource::create([
            'name' => 'Remotive Remote Jobs',
            'endpoint' => 'https://remotive.com/api/remote-jobs?search={query}',
            'type' => 'api',
            'mode' => 'static',
            'status' => 'active',
            'method' => 'GET',
        ]);

        $this->withToken('scraper-secret')
            ->postJson('/api/jobs/import', [
                'title' => 'Remote PHP Developer',
                'description' => 'Build Laravel APIs for a production product team.',
                'company' => 'Invalid Url Co',
                'url' => 'not-a-public-url',
                'scraping_source_id' => $source->id,
                'source' => 'Remotive',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['url']);
    }

    public function test_demo_url_is_allowed_for_demo_source(): void
    {
        config(['services.scrapy.token' => 'scraper-secret']);

        $source = ScrapingSource::create([
            'name' => 'CareerCompass Demo Jobs',
            'endpoint' => 'demo://careercompass/jobs',
            'type' => 'api',
            'mode' => 'static',
            'status' => 'active',
            'method' => 'GET',
        ]);

        $this->withToken('scraper-secret')
            ->postJson('/api/jobs/import', [
                'title' => 'Demo Laravel Developer',
                'description' => 'Deterministic demo role for validating CareerCompass imports.',
                'company' => 'CareerCompass Labs',
                'url' => 'https://careercompass.local/demo-jobs/demo-laravel-developer-1',
                'scraping_source_id' => $source->id,
                'source' => 'CareerCompass Demo Jobs',
            ])
            ->assertCreated();
    }

    public function test_duplicate_by_url_updates_existing_job(): void
    {
        config(['services.scrapy.token' => 'scraper-secret']);

        $payload = [
            'title' => 'Remote Python Developer',
            'description' => 'Build Python APIs for production systems.',
            'company' => 'URL Duplicate Co',
            'url' => 'https://example.test/jobs/url-duplicate',
            'skills' => ['Python'],
            'work_type' => 'remote',
            'source' => 'RemoteOK',
        ];

        $this->withToken('scraper-secret')
            ->postJson('/api/jobs/import', $payload)
            ->assertCreated()
            ->assertJsonPath('created', true);

        $payload['title'] = 'Senior Remote Python Developer';
        $payload['description'] = 'Updated Python API ownership role.';

        $this->withToken('scraper-secret')
            ->postJson('/api/jobs/import', $payload)
            ->assertOk()
            ->assertJsonPath('created', false);

        $this->assertSame(1, Job::where('url', 'https://example.test/jobs/url-duplicate')->count());
        $this->assertDatabaseHas('job_postings', [
            'url' => 'https://example.test/jobs/url-duplicate',
            'title' => 'Senior Remote Python Developer',
            'description' => 'Updated Python API ownership role.',
        ]);
    }

    public function test_scraped_job_import_is_idempotent_by_title_and_company(): void
    {
        config(['services.scrapy.token' => 'scraper-secret']);

        $payload = [
            'title' => 'remote laravel developer',
            'description' => 'Build Laravel APIs.',
            'company' => 'Duplicate Safe Co',
            'url' => 'https://example.test/jobs/original',
            'location' => 'Remote',
            'skills' => ['Laravel'],
            'work_type' => 'remote',
            'source' => 'Adzuna',
        ];

        $this->withToken('scraper-secret')
            ->postJson('/api/jobs/import', $payload)
            ->assertCreated()
            ->assertJsonPath('created', true);

        $payload['url'] = 'https://example.test/jobs/updated';
        $payload['description'] = 'Updated Laravel API role.';

        $this->withToken('scraper-secret')
            ->postJson('/api/jobs/import', $payload)
            ->assertOk()
            ->assertJsonPath('created', false);

        $this->assertSame(1, Job::where('title', 'Remote Laravel Developer')
            ->where('company', 'Duplicate Safe Co')
            ->count());
        $this->assertDatabaseHas('job_postings', [
            'title' => 'Remote Laravel Developer',
            'company' => 'Duplicate Safe Co',
            'url' => 'https://example.test/jobs/updated',
        ]);
    }

    public function test_bad_payload_returns_useful_validation_errors(): void
    {
        config(['services.scrapy.token' => 'scraper-secret']);

        $this->withToken('scraper-secret')
            ->postJson('/api/jobs/import', [
                'title' => '',
                'company' => '',
                'description' => '',
                'url' => '',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['title', 'company', 'description', 'url', 'source']);
    }
}
