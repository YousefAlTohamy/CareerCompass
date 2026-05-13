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
}
