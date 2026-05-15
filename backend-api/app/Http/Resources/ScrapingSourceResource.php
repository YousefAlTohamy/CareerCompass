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
        $support = method_exists($this->resource, 'supportMetadata')
            ? $this->resource->supportMetadata()
            : [];

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
            'support_status' => $support['support_status'] ?? 'unknown',
            'requires_credentials' => (bool) ($support['requires_credentials'] ?? false),
            'requires_proxy' => (bool) ($support['requires_proxy'] ?? false),
            'adapter_name' => $support['adapter_name'] ?? $this->type,
            'is_runnable' => (bool) ($support['is_runnable'] ?? false),
            'recommended_action' => $support['recommended_action'] ?? null,
            'implementation_notes' => $support['implementation_notes'] ?? null,
            'headers'      => $this->headers ?? [],
            'params'       => $this->params ?? [],
            'created_at'   => $this->created_at?->toIso8601String(),
            'updated_at'   => $this->updated_at?->toIso8601String(),
        ];
    }
}
