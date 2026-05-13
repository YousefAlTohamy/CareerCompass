<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScrapingFailedUrl extends Model
{
    protected $table = 'scraping_failed_urls';

    protected $fillable = [
        'scraping_job_id',
        'scraping_source_id',
        'url',
        'error_message',
        'retried',
        'failed_at',
    ];

    protected $casts = [
        'retried' => 'boolean',
        'failed_at' => 'datetime',
    ];

    public function scrapingJob(): BelongsTo
    {
        return $this->belongsTo(ScrapingJob::class, 'scraping_job_id');
    }

    public function scrapingSource(): BelongsTo
    {
        return $this->belongsTo(ScrapingSource::class, 'scraping_source_id');
    }
}
