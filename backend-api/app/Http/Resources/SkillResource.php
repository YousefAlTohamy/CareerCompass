<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SkillResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'                => $this->id,
            'name'              => $this->name,
            'type'              => $this->type,
            'confidence_score'  => $this->whenPivotLoaded('user_skills', fn () => $this->pivot->confidence_score),
            'evidence'          => $this->whenPivotLoaded('user_skills', fn () => $this->pivot->evidence),
            'added_at'          => $this->whenPivotLoaded('user_skills', fn () => $this->pivot->created_at),
        ];
    }
}
