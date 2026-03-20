<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CvAnalysis extends Model
{
    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'parsing_status',
        'completeness_score',
        'strengths',
        'gaps',
        'red_flags',
        'raw_json_output',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'strengths' => 'array',
        'gaps' => 'array',
        'red_flags' => 'array',
        'raw_json_output' => 'array',
    ];

    /**
     * Get the user that owns the CV analysis.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
