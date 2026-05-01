<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class JobResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'company' => $this->company,
            'description' => $this->description,
            'url' => $this->url,
            'source' => $this->source,
            'location' => $this->location,
            'salary_range' => $this->salary_range,
            'job_type' => $this->job_type,
            'experience' => $this->experience,
            'requirements' => $this->requirements,
            'work_type' => $this->work_type,
            'created_at' => $this->created_at,
            'match_percentage' => $this->when(isset($this->match_percentage), $this->match_percentage),
            'skills' => SkillResource::collection($this->whenLoaded('skills')),
            'skills_count' => $this->when(
                $this->relationLoaded('skills'),
                fn() => $this->skills->count()
            ),
        ];
    }
}
