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
            'source_label' => $this->scrapingSource?->name ?? $this->source,
            'scraping_source' => $this->whenLoaded('scrapingSource', fn () => [
                'id' => $this->scrapingSource?->id,
                'name' => $this->scrapingSource?->name,
                'type' => $this->scrapingSource?->type,
                'adapter_name' => $this->scrapingSource?->adapterName(),
                'adapter_mode' => $this->scrapingSource?->supportMetadata()['adapter_mode'] ?? null,
            ]),
            'location' => $this->location,
            'salary_range' => $this->salary_range,
            'job_type' => $this->job_type,
            'experience' => $this->experience,
            'requirements' => $this->requirements,
            'work_type' => $this->work_type,
            'has_valid_external_url' => $this->hasValidExternalUrl(),
            'created_at' => $this->created_at,
            'match_percentage' => $this->when(isset($this->match_percentage), $this->match_percentage),
            'match_score' => $this->when(isset($this->match_percentage), $this->match_percentage),
            'skills' => SkillResource::collection($this->whenLoaded('requiredSkills')),
            'skills_count' => $this->when(
                $this->relationLoaded('requiredSkills'),
                fn() => $this->requiredSkills->count()
            ),
        ];
    }

    private function hasValidExternalUrl(): bool
    {
        if (!$this->url) {
            return false;
        }

        $parts = parse_url((string) $this->url);
        if (!is_array($parts)) {
            return false;
        }

        return in_array(strtolower((string) ($parts['scheme'] ?? '')), ['http', 'https'], true)
            && filled($parts['host'] ?? null);
    }
}
