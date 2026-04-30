<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

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

    // -----------------------------------------------------------------
    // Relationships
    // -----------------------------------------------------------------

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

    // -----------------------------------------------------------------
    // Attribute Mutators (Laravel 12 / Attribute class syntax)
    // -----------------------------------------------------------------

    /**
     * Interact with the job's title.
     *
     * GET — returns the title as-is from the database.
     * SET — applies three sanitisation rules before persisting:
     *
     *   1. **Trim & collapse whitespace** — removes leading/trailing spaces
     *      and collapses multiple internal spaces into one.
     *   2. **Title Case conversion** — normalises casing so titles are
     *      stored consistently (e.g. "senior python developer" becomes
     *      "Senior Python Developer").
     *   3. **Reject raw URLs** — if the value looks like an HTTP(S) URL
     *      rather than a human-readable title, it is replaced with an
     *      empty string to prevent garbage persistence.
     *   4. **Reject large-number / count strings** — strings that are
     *      primarily numeric (e.g. "4178000", "1,200+") or contain
     *      job-count patterns are replaced with an empty string.
     */
    protected function title(): Attribute
    {
        return Attribute::make(
            get: fn (?string $value) => $value,
            set: function (?string $value) {
                if ($value === null) {
                    return null;
                }

                // 1. Trim and collapse internal whitespace
                $cleaned = trim(preg_replace('/\s+/', ' ', $value));

                // 2. Reject raw URLs — titles should never be URLs
                if (preg_match('#^https?://#i', $cleaned)) {
                    return '';
                }

                // 3. Reject strings that are primarily large numbers
                //    e.g. "4,178,000+", "1200", "500+ jobs"
                $digitsOnly = preg_replace('/[\s,+.\-]/', '', $cleaned);
                if (strlen($digitsOnly) > 0 && ctype_digit($digitsOnly) && strlen($digitsOnly) >= 3) {
                    return '';
                }

                // 4. Reject job-count / search-metadata patterns that
                //    slipped through the Python pipeline
                $countPatterns = [
                    '/\d{1,3}(?:,\d{3})*\+?\s*(?:jobs?|results?|positions?|openings?)/i',
                    '/\b(?:showing|page)\s+\d+/i',
                    '/\bresults?\s+for\b/i',
                ];
                foreach ($countPatterns as $pattern) {
                    if (preg_match($pattern, $cleaned)) {
                        return '';
                    }
                }

                // 5. Convert to Title Case
                //    Use Str::title for consistent casing, then fix common
                //    tech acronyms that should stay uppercase (e.g. "Php" → "PHP")
                $titleCased = Str::title($cleaned);
                $titleCased = self::fixTechAcronyms($titleCased);

                return $titleCased;
            },
        );
    }

    // -----------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------

    /**
     * Fix common tech acronyms that Str::title() incorrectly lowercases.
     *
     * "Php" → "PHP", "Sql" → "SQL", "Aws" → "AWS", etc.
     * Only replaces whole words to avoid mangling partial matches.
     */
    private static function fixTechAcronyms(string $title): string
    {
        $acronyms = [
            'Php'  => 'PHP',
            'Sql'  => 'SQL',
            'Aws'  => 'AWS',
            'Api'  => 'API',
            'Ui'   => 'UI',
            'Ux'   => 'UX',
            'Qa'   => 'QA',
            'Ml'   => 'ML',
            'Ai'   => 'AI',
            'Cto'  => 'CTO',
            'Ceo'  => 'CEO',
            'Cfo'  => 'CFO',
            'Devops'  => 'DevOps',
            'Ios'     => 'iOS',
            'Saas'    => 'SaaS',
            'Hr'      => 'HR',
            'It'      => 'IT',
            'Seo'     => 'SEO',
            'Erp'     => 'ERP',
            'Crm'     => 'CRM',
        ];

        foreach ($acronyms as $wrong => $correct) {
            // Word-boundary replacement to avoid partial matches
            $title = preg_replace(
                '/\b' . preg_quote($wrong, '/') . '\b/',
                $correct,
                $title
            );
        }

        return $title;
    }
}
