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
            'completeness_score' => (int) $this->completeness_score,
            'match_score'        => (float) $this->match_score, // حقل جديد
            'seniority'          => $this->seniority,           // حقل جديد
            'primary_domain'     => $this->primary_domain,      // حقل جديد
            'summary'            => $this->summary,             // حقل جديد
            'strengths'          => $this->strengths ?? [],
            'gaps'               => $this->gaps ?? [],
            'red_flags'          => $this->red_flags ?? [],
            'created_at'         => $this->created_at?->toIso8601String(),
            'updated_at'         => $this->updated_at?->toIso8601String(),
        ];
    }
}
