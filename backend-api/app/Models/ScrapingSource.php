<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Log;

class ScrapingSource extends Model
{
    protected $table = 'scraping_sources';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'endpoint',
        'method',
        'type',
        'mode',
        'pattern',
        'status',
        'headers',
        'params',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'headers' => 'array',
        'params'  => 'array',
    ];

    /**
     * Scope: only active sources.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope: only API-type sources.
     */
    public function scopeApi($query)
    {
        return $query->where('type', 'api');
    }

    /**
     * Scope: only HTML-type sources.
     */
    public function scopeHtml($query)
    {
        return $query->where('type', 'html');
    }

    /**
     * Jobs originating from this source.
     */
    public function jobs(): HasMany
    {
        return $this->hasMany(Job::class, 'scraping_source_id');
    }

    /**
     * Failed URLs originating from this source.
     */
    public function failedUrls(): HasMany
    {
        return $this->hasMany(ScrapingFailedUrl::class, 'scraping_source_id');
    }

    /**
     * Check if the source is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /**
     * Toggle the source status between active and inactive.
     */
    public function toggle(): void
    {
        $this->status = $this->isActive() ? 'inactive' : 'active';
        $this->save();
    }

    /**
     * Calculate a rolling health score based on recent jobs from this source.
     *
     * Score = (Success Rate * 0.7) + (Data Completeness * 0.3)
     * Returned value is 0..100.
     *
     * Safety:
     * - requires a minimum sample size before it can deactivate a source
     * - uses a rolling window (latest N jobs)
     */
    public function calculateHealthScore(int $window = 10, int $minSamples = 10): float
    {
        $recent = $this->jobs()
            ->latest()
            ->take($window)
            ->get(['id', 'title', 'company', 'description', 'url']);

        $count = $recent->count();
        if ($count < $minSamples) {
            return 100.0;
        }

        $successes = 0;
        $completenessSum = 0.0;

        foreach ($recent as $job) {
            $hasTitle = !empty($job->title);
            $hasCompany = !empty($job->company);
            $hasDescription = !empty($job->description) && mb_strlen((string) $job->description) >= 120;
            $hasUrl = !empty($job->url);

            $fields = [$hasTitle, $hasCompany, $hasDescription, $hasUrl];
            $present = count(array_filter($fields));

            // "Success" is defined as having the core fields populated.
            if ($present >= 3) {
                $successes++;
            }

            $completenessSum += ($present / 4.0);
        }

        $successRate = $successes / $count;              // 0..1
        $dataCompleteness = $completenessSum / $count;   // 0..1

        $score = (($successRate * 0.7) + ($dataCompleteness * 0.3)) * 100.0;
        return max(0.0, min(100.0, $score));
    }

    /**
     * Deactivate the source if it is unhealthy, with safeguards against
     * temporary blips.
     */
    public function deactivateIfUnhealthy(float $threshold = 20.0, int $window = 10, int $minSamples = 10): float
    {
        $score = $this->calculateHealthScore($window, $minSamples);

        if ($score < $threshold && $this->isActive()) {
            $this->status = 'inactive';
            $this->save();

            Log::warning('Scraping source deactivated due to low health score', [
                'source_id' => $this->id,
                'source_name' => $this->name,
                'health_score' => $score,
                'threshold' => $threshold,
                'window' => $window,
                'min_samples' => $minSamples,
            ]);
        }

        return $score;
    }
}
