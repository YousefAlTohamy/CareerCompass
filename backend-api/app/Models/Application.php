<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Application extends Model
{
    protected $fillable = [
        'user_id',
        'job_id',
        'status',
        'notes',
        'applied_at'
    ];

    /**
     * Get the user that owns the application.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the job associated with the application.
     */
    public function job(): BelongsTo
    {
        return $this->belongsTo(Job::class, 'job_id');
    }
}
