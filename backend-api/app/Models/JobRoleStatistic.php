<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JobRoleStatistic extends Model
{
    protected $table = 'job_role_statistics';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'role_title',
        'total_jobs_analyzed',
        'top_skills',
        'average_experience_level',
        'common_locations',
        'salary_range',
        'last_scraped_at',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'top_skills' => 'array',
        'common_locations' => 'array',
        'last_scraped_at' => 'datetime',
        'total_jobs_analyzed' => 'integer',
    ];

    /**
     * Scope to get fresh statistics (updated within last 7 days).
     */
    public function scopeFresh($query)
    {
        return $query->where('last_scraped_at', '>=', now()->subDays(7));
    }

    /**
     * Scope to get stale statistics (older than 7 days).
     */
    public function scopeStale($query)
    {
        return $query->where(function ($q) {
            $q->whereNull('last_scraped_at')
                ->orWhere('last_scraped_at', '<', now()->subDays(7));
        });
    }

    /**
     * Update statistics with new data.
     */
    public function updateStatistics(array $data): void
    {
        $this->update([
            'total_jobs_analyzed' => $data['total_jobs'] ?? $this->total_jobs_analyzed,
            'top_skills' => $data['top_skills'] ?? $this->top_skills,
            'average_experience_level' => $data['average_experience'] ?? $this->average_experience_level,
            'common_locations' => $data['common_locations'] ?? $this->common_locations,
            'salary_range' => $data['salary_range'] ?? $this->salary_range,
            'last_scraped_at' => now(),
        ]);
    }
}
