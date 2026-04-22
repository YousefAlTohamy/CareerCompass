<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScrapingFailedUrl extends Model
{
    protected $table = 'scraping_failed_urls';

    protected $fillable = [
        'scraping_job_id',
        'url',
        'reason',
        'source_name',
        'retried',
    ];

    protected $casts = [
        'retried' => 'boolean',
    ];

    public function scrapingJob(): BelongsTo
    {
        return $this->belongsTo(ScrapingJob::class, 'scraping_job_id');
    }
}
