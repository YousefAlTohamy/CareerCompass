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
        'seniority',
        'predicted_role',
        'primary_domain',
        'confidence_score',
        'summary',
        'completeness_score',
        'strengths',
        'gaps',
        'red_flags',
        'metadata',
        'raw_json_output',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'confidence_score' => 'float',
        'completeness_score' => 'integer',
        'strengths' => 'array',
        'gaps' => 'array',
        'red_flags' => 'array',
        'metadata' => 'array',
        'raw_json_output' => 'array',
    ];

    /**
     * Seniority levels recognized by the AI engine.
     */
    public const SENIORITY_LEVELS = [
        'intern',
        'junior',
        'mid',
        'senior',
        'lead',
        'principal',
    ];

    /**
     * Check if OCR was used for extraction.
     */
    public function wasOcrUsed(): bool
    {
        return $this->parsing_status === 'ocr_fallback';
    }

    /**
     * Get the skill durations from metadata.
     *
     * @return array<string, float>
     */
    public function getSkillDurations(): array
    {
        return $this->metadata['experience']['skill_durations'] ?? [];
    }

    /**
     * Get the top skills by years from metadata.
     *
     * @return array<int, array{skill: string, years: float}>
     */
    public function getTopSkillsByYears(): array
    {
        return $this->metadata['experience']['top_skills_by_years'] ?? [];
    }

    /**
     * Get the action verb score from metadata.
     */
    public function getActionVerbScore(): float
    {
        return (float) ($this->metadata['experience']['action_verb_score'] ?? 0.0);
    }

    /**
     * Get the user that owns the CV analysis.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
