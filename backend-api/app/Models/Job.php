<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Job extends Model
{
    protected $table = 'job_postings';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'title',
        'description',
        'company',
        'location',
        'salary_range',
        'job_type',
        'experience',
        'url',
        'source',
        'scraping_source_id',
    ];

    /**
     * Get the skills required for this job.
     */
    public function skills(): BelongsToMany
    {
        return $this->belongsToMany(Skill::class, 'job_skills')
            ->withPivot('required', 'importance_score', 'importance_category')
            ->withTimestamps();
    }

    /**
     * Get the scraping source that produced this job.
     */
    public function scrapingSource(): BelongsTo
    {
        return $this->belongsTo(ScrapingSource::class, 'scraping_source_id');
    }
}
