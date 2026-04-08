<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CvAnalysisResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'                 => $this->id,
            'parsing_status'     => $this->parsing_status,
            'seniority'          => $this->seniority,
            'predicted_role'     => $this->predicted_role,
            'primary_domain'     => $this->primary_domain,
            'confidence_score'   => $this->confidence_score,
            'summary'            => $this->summary,
            'completeness_score' => $this->completeness_score,
            'strengths'          => $this->strengths ?? [],
            'gaps'               => $this->gaps ?? [],
            'red_flags'          => $this->red_flags ?? [],
            'metadata'           => $this->metadata ?? [],
            'created_at'         => $this->created_at?->toIso8601String(),
            'updated_at'         => $this->updated_at?->toIso8601String(),
        ];
    }
}
