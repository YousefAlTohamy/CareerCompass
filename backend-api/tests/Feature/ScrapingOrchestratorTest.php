<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\ScrapingSource;
use App\Models\TargetJobRole;
use App\Models\User;
use App\Services\ScraperClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Mockery;
use Tests\TestCase;

class ScrapingOrchestratorTest extends TestCase
{
    use RefreshDatabase;

    public function test_diagnostics_cover_all_active_sources_and_skip_inactive_ones(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $activeOne = ScrapingSource::create([
            'name' => 'Active API Source',
            'endpoint' => 'https://example.test/api/jobs?query={query}',
            'type' => 'api',
            'mode' => 'static',
            'status' => 'active',
            'method' => 'GET',
        ]);

        $activeTwo = ScrapingSource::create([
            'name' => 'Active SPA Source',
            'endpoint' => 'https://www.linkedin.com/jobs/search/?keywords={query}',
            'type' => 'spa',
            'mode' => 'discovery',
            'status' => 'active',
            'method' => 'GET',
        ]);

        $inactive = ScrapingSource::create([
            'name' => 'Inactive Source',
            'endpoint' => 'https://example.test/inactive?query={query}',
            'type' => 'html',
            'mode' => 'static',
            'status' => 'inactive',
            'method' => 'GET',
        ]);

        $calls = [];
        $mock = Mockery::mock(ScraperClient::class);
        $mock->shouldReceive('scrape')
            ->twice()
            ->andReturnUsing(function (
                string $query,
                int $limit,
                int $scrapingJobId,
                ?int $sourceId = null,
                bool $allowFailure = false
            ) use (&$calls, $activeOne, $activeTwo): array {
                $calls[] = [$query, $limit, $scrapingJobId, $sourceId, $allowFailure];

                if ($sourceId === $activeOne->id) {
                    return [
                        'success' => true,
                        'classification' => 'SUCCESS',
                        'query' => $query,
                        'source_id' => $sourceId,
                        'source_name' => $activeOne->name,
                        'source_type' => $activeOne->type,
                        'source_mode' => $activeOne->mode,
                        'endpoint_used' => $activeOne->endpoint,
                        'scraping_job_id' => $scrapingJobId,
                        'jobs_preview_count' => 1,
                        'jobs_stored' => 1,
                        'failed_urls_count' => 0,
                        'elapsed_ms' => 250,
                        'stdout' => 'ok',
                        'stderr' => '',
                        'error_summary' => null,
                        'output_excerpt' => 'ok',
                    ];
                }

                return [
                    'success' => false,
                    'classification' => 'EXTERNAL_FAILED',
                    'query' => $query,
                    'source_id' => $sourceId,
                    'source_name' => $activeTwo->name,
                    'source_type' => $activeTwo->type,
                    'source_mode' => $activeTwo->mode,
                    'endpoint_used' => $activeTwo->endpoint,
                    'scraping_job_id' => $scrapingJobId,
                    'jobs_preview_count' => 0,
                    'jobs_stored' => 0,
                    'failed_urls_count' => 1,
                    'elapsed_ms' => 500,
                    'stdout' => '',
                    'stderr' => 'Proxy timeout',
                    'error_summary' => 'Proxy timeout',
                    'output_excerpt' => 'Page.goto: net::ERR_TIMED_OUT',
                ];
            });

        $this->app->instance(ScraperClient::class, $mock);

        $response = $this->postJson('/api/v1/admin/scraping-sources/test');

        $response->assertOk()
            ->assertJsonPath('diagnostic_query', 'Software')
            ->assertJsonPath('total_sources', 2)
            ->assertJsonPath('passed_sources', 1)
            ->assertJsonPath('failed_sources', 1)
            ->assertJsonPath('overall_status', 'partial_failure')
            ->assertJsonCount(2, 'results');

        $this->assertCount(2, $calls);
        $this->assertSame('Software', $calls[0][0]);
        $this->assertSame('Software', $calls[1][0]);
        $this->assertEqualsCanonicalizing([$activeOne->id, $activeTwo->id], [$calls[0][3], $calls[1][3]]);
    }

    public function test_single_source_diagnostic_uses_the_selected_source_even_when_inactive(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $source = ScrapingSource::create([
            'name' => 'Inactive HTML Source',
            'endpoint' => 'https://example.test/jobs?query={query}',
            'type' => 'html',
            'mode' => 'static',
            'status' => 'inactive',
            'method' => 'POST',
        ]);

        $mock = Mockery::mock(ScraperClient::class);
        $mock->shouldReceive('scrape')
            ->once()
            ->with(
                'Software',
                1,
                Mockery::type('int'),
                $source->id,
                true
            )
            ->andReturn([
                'success' => true,
                'classification' => 'SUCCESS',
                'query' => 'Software',
                'source_id' => $source->id,
                'source_name' => $source->name,
                'source_type' => $source->type,
                'source_mode' => $source->mode,
                'endpoint_used' => $source->endpoint,
                'scraping_job_id' => 1,
                'jobs_preview_count' => 1,
                'jobs_stored' => 1,
                'failed_urls_count' => 0,
                'elapsed_ms' => 150,
                'stdout' => 'ok',
                'stderr' => '',
                'error_summary' => null,
                'output_excerpt' => 'ok',
            ]);

        $this->app->instance(ScraperClient::class, $mock);

        $this->postJson("/api/v1/admin/scraping-sources/{$source->id}/test")
            ->assertOk()
            ->assertJsonPath('total_sources', 1)
            ->assertJsonPath('results.0.source_id', $source->id)
            ->assertJsonPath('results.0.endpoint_used', $source->endpoint)
            ->assertJsonPath('results.0.classification', 'SUCCESS');
    }

    public function test_run_extractions_requires_active_sources_and_active_targets(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->postJson('/api/v1/admin/scraping/run-full')
            ->assertStatus(422)
            ->assertJsonPath('message', 'No active scraping sources found. Activate at least one source before running extractions.');

        ScrapingSource::create([
            'name' => 'Active Demo Source',
            'endpoint' => 'demo://careercompass/jobs',
            'type' => 'api',
            'mode' => 'static',
            'status' => 'active',
            'method' => 'GET',
        ]);

        $this->postJson('/api/v1/admin/scraping/run-full')
            ->assertStatus(422)
            ->assertJsonPath('message', 'No active target roles found. Activate at least one target role before running extractions.');
    }

    public function test_run_extractions_dispatches_active_source_target_matrix(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $sourceOne = ScrapingSource::create([
            'name' => 'Demo Source One',
            'endpoint' => 'https://example.test/api/jobs?query={query}',
            'type' => 'api',
            'mode' => 'static',
            'status' => 'active',
            'method' => 'GET',
        ]);

        $sourceTwo = ScrapingSource::create([
            'name' => 'Demo Source Two',
            'endpoint' => 'https://example.test/jobs?q={query}',
            'type' => 'html',
            'mode' => 'discovery',
            'status' => 'active',
            'method' => 'GET',
        ]);

        TargetJobRole::create([
            'name' => 'Backend Laravel Developer',
            'search_query' => 'Backend Laravel Developer',
            'is_active' => true,
        ]);

        TargetJobRole::create([
            'name' => 'Frontend React Developer',
            'search_query' => 'Frontend React Developer',
            'is_active' => true,
        ]);

        Bus::fake();

        $response = $this->postJson('/api/v1/admin/scraping/run-full');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('active_sources', 2)
            ->assertJsonPath('active_targets', 2)
            ->assertJsonPath('planned_runs', 4);

        Bus::assertBatched(function ($batch): bool {
            return $batch->jobs->count() === 4
                && ($batch->options['queue'] ?? null) === 'scraping';
        });
    }

    public function test_status_endpoint_returns_summary_and_source_progress_data(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $source = ScrapingSource::create([
            'name' => 'Status Source',
            'endpoint' => 'https://example.test/api/jobs?query={query}',
            'type' => 'api',
            'mode' => 'static',
            'status' => 'active',
            'method' => 'GET',
        ]);

        TargetJobRole::create([
            'name' => 'Backend Developer',
            'search_query' => 'Backend Developer',
            'is_active' => true,
        ]);

        Cache::put("scraping_source_{$source->id}_status", [
            'is_scraping' => true,
            'status' => 'running',
            'progress_percent' => 40,
            'target' => 'Backend Developer',
            'query' => 'Backend Developer',
            'scraping_job_id' => 77,
            'jobs_found' => 8,
            'jobs_stored' => 5,
            'failed_count' => 1,
            'elapsed_seconds' => 18,
            'message' => 'Running Status Source',
            'last_error' => 'Proxy timeout',
            'last_updated_at' => now()->toIso8601String(),
        ], now()->addHours(2));

        $this->getJson('/api/v1/admin/scraping-sources/status')
            ->assertOk()
            ->assertJsonPath('data.summary.active_sources', 1)
            ->assertJsonPath('data.summary.active_targets', 1)
            ->assertJsonPath('data.summary.planned_runs', 1)
            ->assertJsonPath('data.sources.' . $source->id . '.status', 'running')
            ->assertJsonPath('data.sources.' . $source->id . '.jobs_stored', 5)
            ->assertJsonPath('data.sources.' . $source->id . '.failed_count', 1);
    }
}
