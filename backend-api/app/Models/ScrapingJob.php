<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ScrapingJob extends Model
{
    protected $table = 'scraping_jobs';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'job_title',
        'status',
        'type',
        'jobs_found',
        'jobs_stored',
        'jobs_duplicated',
        'discovered_count',
        'failed_count',
        'processing_time_ms',
        'error_message',
        'started_at',
        'completed_at',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'jobs_found' => 'integer',
        'jobs_stored' => 'integer',
        'jobs_duplicated' => 'integer',
        'discovered_count' => 'integer',
        'failed_count' => 'integer',
        'processing_time_ms' => 'integer',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    /**
     * Scope to get pending jobs.
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    /**
     * Scope to get processing jobs.
     */
    public function scopeProcessing($query)
    {
        return $query->where('status', 'processing');
    }

    /**
     * Scope to get completed jobs.
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    /**
     * Scope to get failed jobs.
     */
    public function scopeFailed($query)
    {
        return $query->where('status', 'failed');
    }

    /**
     * Scope to get on-demand jobs.
     */
    public function scopeOnDemand($query)
    {
        return $query->where('type', 'on_demand');
    }

    /**
     * Scope to get scheduled jobs.
     */
    public function scopeScheduled($query)
    {
        return $query->where('type', 'scheduled');
    }

    /**
     * Mark job as started.
     */
    public function markAsStarted(): void
    {
        $this->update([
            'status' => 'processing',
            'started_at' => now(),
        ]);
    }

    /**
     * Mark job as completed.
     */
    public function markAsCompleted(
        int $found,
        int $stored,
        int $duplicated,
        int $discoveredCount = 0,
        int $failedCount = 0,
        ?int $processingTimeMs = null
    ): void
    {
        if ($processingTimeMs === null && $this->started_at) {
            $processingTimeMs = (int) max(
                0,
                $this->started_at->diffInMilliseconds(now(), false)
            );
        }

        $this->update([
            'status' => 'completed',
            'jobs_found' => $found,
            'jobs_stored' => $stored,
            'jobs_duplicated' => $duplicated,
            'discovered_count' => $discoveredCount,
            'failed_count' => $failedCount,
            'processing_time_ms' => (int) ($processingTimeMs ?? 0),
            'completed_at' => now(),
        ]);
    }

    /**
     * Mark job as failed.
     */
    public function markAsFailed(
        string $errorMessage,
        int $discoveredCount = 0,
        int $failedCount = 0,
        ?int $processingTimeMs = null
    ): void
    {
        if ($processingTimeMs === null && $this->started_at) {
            $processingTimeMs = (int) max(
                0,
                $this->started_at->diffInMilliseconds(now(), false)
            );
        }

        $this->update([
            'status' => 'failed',
            'error_message' => $errorMessage,
            'discovered_count' => $discoveredCount,
            'failed_count' => $failedCount,
            'processing_time_ms' => (int) ($processingTimeMs ?? 0),
            'completed_at' => now(),
        ]);
    }

    /**
     * Failed URLs (Dead Letter Queue) for this scraping run.
     */
    public function failedUrls(): HasMany
    {
        return $this->hasMany(ScrapingFailedUrl::class, 'scraping_job_id');
    }
}
