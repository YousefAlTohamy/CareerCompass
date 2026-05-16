<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use App\Services\CvStorageService;

class UserResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     * Exposes comprehensive user data with profile, experiences, skills (including pivot data).
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $this->resource->loadMissing(['profile', 'experiences', 'skills']);

        $profile = $this->profile;

        $cvUrl = null;
        if ($this->relationLoaded('cvAnalysis') && $this->cvAnalysis?->cv_path) {
            try {
                $cvUrl = app(CvStorageService::class)->temporaryDownloadUrl($this->cvAnalysis);
            } catch (\Throwable) {
                $cvUrl = null;
            }
        }

        return [
            'id'         => $this->id,
            'name'       => $this->name,
            'email'      => $this->email,
            'role'       => $this->role,
            'created_at' => $this->created_at,

            // Backward compatibility: job_title maps to profile->headline
            'job_title'  => $profile?->headline ?? null,

            // Flattened essential profile fields for easy frontend access
            'headline'               => $profile?->headline,
            'summary'                => $profile?->summary,
            'location'               => $profile?->location,
            'total_experience_years' => $profile?->total_experience_years,
            'seniority'              => $profile?->seniority,
            'primary_domain'         => $profile?->primary_domain,

            // Legacy contact accessors (from profile.contact_info)
            'phone'       => $this->phone,
            'linkedin_url'=> $this->linkedin_url,
            'github_url'  => $this->github_url,
            'cv_url'      => $cvUrl,

            // Full profile object (nested)
            'profile' => $this->whenLoaded('profile', fn () => $profile ? [
                'headline'               => $profile->headline,
                'summary'                => $profile->summary,
                'location'               => $profile->location,
                'total_experience_years' => $profile->total_experience_years,
                'seniority'              => $profile->seniority,
                'primary_domain'         => $profile->primary_domain,
                'contact_info'           => $profile->contact_info ?? [],
            ] : null),

            // Experiences from UserExperience model
            'experiences' => UserExperienceResource::collection($this->whenLoaded('experiences')),

            // Skills with pivot data (confidence_score, evidence)
            'skills' => SkillResource::collection($this->whenLoaded('skills')),

            // CV analysis (latest) when loaded; null if none exists
            'cv_analysis' => $this->when(
                $this->relationLoaded('cvAnalysis') && $this->cvAnalysis,
                fn () => new CvAnalysisResource($this->cvAnalysis),
            ),
        ];
    }
}
