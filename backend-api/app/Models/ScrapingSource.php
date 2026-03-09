<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

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
        'type',
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
}
