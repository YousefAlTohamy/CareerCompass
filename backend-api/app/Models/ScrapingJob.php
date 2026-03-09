<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

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
    public function markAsCompleted(int $found, int $stored, int $duplicated): void
    {
        $this->update([
            'status' => 'completed',
            'jobs_found' => $found,
            'jobs_stored' => $stored,
            'jobs_duplicated' => $duplicated,
            'completed_at' => now(),
        ]);
    }

    /**
     * Mark job as failed.
     */
    public function markAsFailed(string $errorMessage): void
    {
        $this->update([
            'status' => 'failed',
            'error_message' => $errorMessage,
            'completed_at' => now(),
        ]);
    }
}
