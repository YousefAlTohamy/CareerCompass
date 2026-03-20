<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $this->resource->loadMissing('profile');

        return [
            'id'         => $this->id,
            'name'       => $this->name,
            'email'      => $this->email,
            'role'       => $this->role,
            'job_title'  => $this->job_title,
            'phone'      => $this->phone,
            'location'   => $this->location,
            'linkedin_url' => $this->linkedin_url,
            'github_url' => $this->github_url,
            'profile'    => $this->whenLoaded('profile', fn () => [
                'headline'               => $this->profile->headline,
                'summary'                => $this->profile->summary,
                'location'               => $this->profile->location,
                'total_experience_years' => $this->profile->total_experience_years,
                'seniority'              => $this->profile->seniority,
                'primary_domain'         => $this->profile->primary_domain,
                'contact_info'           => $this->profile->contact_info,
            ]),
        ];
    }
}
