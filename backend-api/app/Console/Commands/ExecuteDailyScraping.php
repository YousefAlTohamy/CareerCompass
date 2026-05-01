<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\ScrapingSource;
use App\Jobs\ProcessOnDemandJobScraping;
use App\Models\ScrapingJob;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class ExecuteDailyScraping extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'scraping:execute-daily';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Iterate through active scraping sources and dispatch scraping jobs';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting daily scraping...');
        $sources = ScrapingSource::active()->get();

        if ($sources->isEmpty()) {
            $this->info('No active scraping sources found.');
            return;
        }

        foreach ($sources as $source) {
            // Check if already scraping
            $status = Cache::get("scraping_source_{$source->id}_status");
            if ($status && isset($status['is_scraping']) && $status['is_scraping']) {
                $this->warn("Source {$source->name} is already being scraped. Skipping.");
                continue;
            }

            // Create tracking job
            $scrapingJob = ScrapingJob::create([
                'job_title' => $source->name,
                'type' => 'daily_schedule',
                'status' => 'pending',
            ]);

            // Dispatch scraping for this source (limit 100 for daily)
            ProcessOnDemandJobScraping::dispatch($source->name, $scrapingJob->id, 100, $source->id);
            $this->info("Dispatched scraping for {$source->name}");
        }

        $this->info('Daily scraping dispatched.');
    }
}
