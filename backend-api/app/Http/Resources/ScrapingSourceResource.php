<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ScrapingSourceResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'name'         => $this->name,
            'endpoint'     => $this->endpoint,
            'type'         => $this->type,
            'mode'         => $this->mode ?? 'static',
            'pattern'      => $this->pattern,
            'method'       => $this->method ?? 'GET',
            'status'       => $this->status,
            'is_active'    => $this->isActive(),
            'health_score' => round($this->calculateHealthScore(), 1),
            'headers'      => $this->headers ?? [],
            'params'       => $this->params ?? [],
            'created_at'   => $this->created_at?->toIso8601String(),
            'updated_at'   => $this->updated_at?->toIso8601String(),
        ];
    }
}
