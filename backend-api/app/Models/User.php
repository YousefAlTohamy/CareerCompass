<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, HasApiTokens;

    protected static function booted(): void
    {
        static::created(function (User $user): void {
            if (!$user->relationLoaded('profile') && !$user->profile()->exists()) {
                $user->profile()->create([]);
            }
        });
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The accessors to append to the model's array form.
     *
     * @var list<string>
     */
    protected $appends = [
        'job_title',
        'phone',
        'location',
        'linkedin_url',
        'github_url',
    ];

    /**
     * Get the profile relation.
     */
    public function profile(): HasOne
    {
        return $this->hasOne(UserProfile::class);
    }

    /**
     * Get the experiences relation.
     */
    public function experiences(): HasMany
    {
        return $this->hasMany(UserExperience::class, 'user_id');
    }

    /**
     * Get the CV analyses relation.
     */
    public function cvAnalyses(): HasMany
    {
        return $this->hasMany(CvAnalysis::class, 'user_id');
    }

    /**
     * Get the skills that belong to the user.
     */
    public function skills(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Skill::class, 'user_skills')
            ->withPivot('confidence_score', 'evidence')
            ->withTimestamps();
    }

    /**
     * Get the applications for the user.
     */
    public function applications(): HasMany
    {
        return $this->hasMany(Application::class);
    }

    /**
     * Get job_title (backward compat alias for profile->headline).
     */
    public function getJobTitleAttribute(): ?string
    {
        return $this->relationLoaded('profile') ? ($this->profile?->headline) : ($this->profile?->headline);
    }

    /**
     * Get phone from contact_info (backward compat).
     */
    public function getPhoneAttribute(): ?string
    {
        $contact = $this->profile?->contact_info;
        return is_array($contact) ? ($contact['phone'] ?? null) : null;
    }

    /**
     * Get location (backward compat).
     */
    public function getLocationAttribute(): ?string
    {
        return $this->profile?->location;
    }

    /**
     * Get linkedin_url from contact_info (backward compat).
     */
    public function getLinkedinUrlAttribute(): ?string
    {
        $contact = $this->profile?->contact_info;
        return is_array($contact) ? ($contact['linkedin_url'] ?? null) : null;
    }

    /**
     * Get github_url from contact_info (backward compat).
     */
    public function getGithubUrlAttribute(): ?string
    {
        $contact = $this->profile?->contact_info;
        return is_array($contact) ? ($contact['github_url'] ?? null) : null;
    }

    /**
     * Get or create the user's profile.
     */
    public function profileOrCreate(): UserProfile
    {
        return $this->profile ?? $this->profile()->create([]);
    }

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
    ];
}
