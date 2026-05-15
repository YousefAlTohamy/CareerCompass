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

    public function adapterName(): string
    {
        $haystack = strtolower(trim(sprintf('%s %s %s', $this->name, $this->endpoint, $this->type)));

        return match (true) {
            str_starts_with((string) $this->endpoint, 'demo://') || in_array($this->type, ['demo', 'local'], true) => 'demo',
            str_contains($haystack, 'remotive.com') => 'remotive',
            str_contains($haystack, 'adzuna.com') => 'adzuna',
            str_contains($haystack, 'remoteok.com') => 'remoteok',
            str_contains($haystack, 'arbeitnow.com') => 'arbeitnow',
            str_contains($haystack, 'wuzzuf.net') => 'wuzzuf',
            str_contains($haystack, 'indeed.com') => 'indeed',
            str_contains($haystack, 'upwork.com') => 'upwork',
            str_contains($haystack, 'linkedin.com') => 'linkedin',
            default => (string) $this->type,
        };
    }

    public function supportMetadata(): array
    {
        $adapter = $this->adapterName();
        $adzunaConfigured = filled(config('services.scraping_sources.adzuna_app_id'))
            && filled(config('services.scraping_sources.adzuna_app_key'));

        return match ($adapter) {
            'demo' => [
                'support_status' => 'demo',
                'requires_credentials' => false,
                'requires_proxy' => false,
                'adapter_name' => 'demo',
                'is_runnable' => true,
                'recommended_action' => 'Ready',
                'implementation_notes' => 'Deterministic local demo adapter; no external network required.',
            ],
            'remotive', 'remoteok', 'arbeitnow' => [
                'support_status' => 'supported',
                'requires_credentials' => false,
                'requires_proxy' => false,
                'adapter_name' => $adapter,
                'is_runnable' => true,
                'recommended_action' => 'Ready',
                'implementation_notes' => 'Public API adapter implemented.',
            ],
            'adzuna' => [
                'support_status' => $adzunaConfigured ? 'supported' : 'config_required',
                'requires_credentials' => true,
                'requires_proxy' => false,
                'adapter_name' => 'adzuna',
                'is_runnable' => $adzunaConfigured,
                'recommended_action' => $adzunaConfigured ? 'Ready' : 'Set ADZUNA_APP_ID and ADZUNA_APP_KEY.',
                'implementation_notes' => 'Adzuna API adapter implemented; credentials are required by Adzuna.',
            ],
            'wuzzuf' => [
                'support_status' => 'external_risk',
                'requires_credentials' => false,
                'requires_proxy' => false,
                'adapter_name' => 'wuzzuf',
                'is_runnable' => true,
                'recommended_action' => 'Ready, but verify live HTML layout.',
                'implementation_notes' => 'Dedicated HTML parser implemented; live site layout or blocking can still affect results.',
            ],
            'indeed', 'upwork' => [
                'support_status' => 'external_risk',
                'requires_credentials' => false,
                'requires_proxy' => false,
                'adapter_name' => $adapter,
                'is_runnable' => true,
                'recommended_action' => 'Ready with external-blocking risk.',
                'implementation_notes' => 'Public page adapter implemented without login, CAPTCHA bypass, or stealth behavior.',
            ],
            'linkedin' => [
                'support_status' => 'external_risk',
                'requires_credentials' => false,
                'requires_proxy' => (bool) config('services.scraping_sources.use_proxies', true),
                'adapter_name' => 'linkedin',
                'is_runnable' => true,
                'recommended_action' => 'Configure reliable proxies or expect external blocking.',
                'implementation_notes' => 'Scrapy/Playwright LinkedIn adapter exists; third-party blocking and proxy timeouts are expected risks.',
            ],
            default => [
                'support_status' => 'adapter_missing',
                'requires_credentials' => false,
                'requires_proxy' => false,
                'adapter_name' => $adapter ?: 'unknown',
                'is_runnable' => false,
                'recommended_action' => 'Implement a source-specific adapter before running this source.',
                'implementation_notes' => 'No source-specific adapter is currently mapped for this endpoint.',
            ],
        };
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
