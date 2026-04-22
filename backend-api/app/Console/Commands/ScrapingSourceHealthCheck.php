<?php

namespace App\Console\Commands;

use App\Models\ScrapingSource;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ScrapingSourceHealthCheck extends Command
{
    protected $signature = 'scraping-sources:health-check
                            {--window=10 : Rolling window size (latest N jobs)}
                            {--min-samples=10 : Minimum samples required before disabling}
                            {--threshold=20 : Disable threshold (0-100)}
                            {--only-active : Only check active sources}';

    protected $description = 'Compute scraping source health scores and deactivate unhealthy sources safely';

    public function handle(): int
    {
        $window = (int) $this->option('window');
        $minSamples = (int) $this->option('min-samples');
        $threshold = (float) $this->option('threshold');
        $onlyActive = (bool) $this->option('only-active');

        $q = ScrapingSource::query();
        if ($onlyActive) {
            $q->where('status', 'active');
        }

        $sources = $q->get();
        if ($sources->isEmpty()) {
            $this->info('No sources found.');
            return self::SUCCESS;
        }

        $disabled = 0;
        foreach ($sources as $source) {
            $score = $source->deactivateIfUnhealthy(
                threshold: $threshold,
                window: $window,
                minSamples: $minSamples,
            );

            $this->line(sprintf(
                "[%s] %s (id=%d) health=%.1f status=%s",
                strtoupper((string) $source->type),
                $source->name,
                $source->id,
                $score,
                $source->status,
            ));

            if ($score < $threshold && $source->status === 'inactive') {
                $disabled++;
            }
        }

        Log::info('Scraping source health check completed', [
            'sources' => $sources->count(),
            'disabled' => $disabled,
            'window' => $window,
            'min_samples' => $minSamples,
            'threshold' => $threshold,
        ]);

        return self::SUCCESS;
    }
}

