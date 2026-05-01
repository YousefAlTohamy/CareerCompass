<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ScrapingProxy extends Model
{
    protected $table = 'scraping_proxies';

    protected $fillable = [
        'host',
        'port',
        'username',
        'password',
        'protocol',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
