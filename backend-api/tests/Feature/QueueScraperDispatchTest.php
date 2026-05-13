<?php

namespace Tests\Feature;

use App\Jobs\ProcessOnDemandJobScraping;
use App\Models\ScrapingJob;
use App\Services\ScraperClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class QueueScraperDispatchTest extends TestCase
{
    use RefreshDatabase;

    public function test_on_demand_scraping_job_calls_scraper_service_over_http(): void
    {
        config([
            'services.scraper_service.url' => 'http://ai-job-miner:8000',
            'services.scraper_service.token' => 'service-secret',
            'services.scraper_service.callback_base_url' => 'http://nginx/api',
        ]);

        Http::fake([
            'http://ai-job-miner:8000/scrape' => Http::response([
                'success' => true,
                'elapsed_ms' => 25,
            ], 200),
        ]);

        $scrapingJob = ScrapingJob::create([
            'job_title' => 'Laravel Developer',
            'status' => 'pending',
            'type' => 'on_demand',
        ]);

        $job = new ProcessOnDemandJobScraping('Laravel Developer', $scrapingJob->id, 25);
        $this->assertSame('scraping', $job->queue);
        $job->handle(app(ScraperClient::class));

        Http::assertSent(fn ($request) => $request->url() === 'http://ai-job-miner:8000/scrape'
            && $request['query'] === 'Laravel Developer'
            && $request['limit'] === 25
            && $request['scraping_job_id'] === $scrapingJob->id
            && $request['callback_base_url'] === 'http://nginx/api'
            && $request->hasHeader('X-Scraper-Service-Token', 'service-secret'));

        $scrapingJob->refresh();

        $this->assertSame('completed', $scrapingJob->status);
        $this->assertSame(0, $scrapingJob->failed_count);
    }
}
