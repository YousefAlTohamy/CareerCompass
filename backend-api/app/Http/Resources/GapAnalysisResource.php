<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

class GapAnalysisResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     * Includes cv_analysis (strengths, gaps, red_flags, completeness_score) from user's CvAnalysis when available.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $cvAnalysis = $this->resource['cv_analysis'] ?? null;

        return [
            'job' => [
                'id' => $this->resource['job']->id,
                'title' => $this->resource['job']->title,
                'company' => $this->resource['job']->company,
                'url' => $this->resource['job']->url,
            ],
            'analysis' => [
                'match_percentage' => round($this->resource['match_percentage'], 1),
                'match_level' => $this->getMatchLevel($this->resource['match_percentage']),
                'total_required_skills' => $this->resource['total_required'],
                'matched_skills_count' => $this->resource['matched_count'],
                'missing_skills_count' => $this->resource['missing_count'],
                'matched_skills' => $this->toArray_($this->resource['matched_skills']),
                'missing_skills' => $this->toArray_($this->resource['missing_skills']),
                'breakdown' => [
                    'technical' => [
                        'required' => $this->resource['technical_required'],
                        'matched' => $this->resource['technical_matched'],
                        'percentage' => $this->resource['technical_required'] > 0
                            ? round(($this->resource['technical_matched'] / $this->resource['technical_required']) * 100, 1)
                            : 0,
                    ],
                    'soft' => [
                        'required' => $this->resource['soft_required'],
                        'matched' => $this->resource['soft_matched'],
                        'percentage' => $this->resource['soft_required'] > 0
                            ? round(($this->resource['soft_matched'] / $this->resource['soft_required']) * 100, 1)
                            : 0,
                    ],
                ],
            ],
            'missing_essential_skills' => $this->toArray_($this->resource['missing_essential_skills'] ?? []),
            'missing_important_skills' => $this->toArray_($this->resource['missing_important_skills'] ?? []),
            'missing_nice_to_have_skills' => $this->toArray_($this->resource['missing_nice_to_have_skills'] ?? []),
            'critical_skills' => $this->toArray_($this->resource['critical_skills'] ?? []),
            'nice_to_have_skills' => $this->toArray_($this->resource['nice_to_have_skills'] ?? []),
            'match_percentage' => round($this->resource['match_percentage'], 1),
            'matched_skills' => $this->toArray_($this->resource['matched_skills']),
            'missing_skills' => $this->toArray_($this->resource['missing_skills']),
            'recommendations' => $this->resource['recommendations'] ?? [],
            'recommended_jobs' => $this->formatRecommendedJobs($this->resource['recommended_jobs'] ?? collect()),

            // CV analysis from V3 parser (persisted during CV upload)
            'cv_analysis' => $cvAnalysis ? [
                'parsing_status'     => $cvAnalysis->parsing_status ?? null,
                'completeness_score' => $cvAnalysis->completeness_score,
                'strengths'          => $cvAnalysis->strengths ?? [],
                'gaps'               => $cvAnalysis->gaps ?? [],
                'red_flags'          => $cvAnalysis->red_flags ?? [],
            ] : null,
        ];
    }

    /**
     * Helper: convert a collection or array of items to a plain array.
     */
    private function toArray_($items): array
    {
        if ($items instanceof Collection) {
            return $items->values()->toArray();
        }
        return array_values((array) $items);
    }

    /**
     * Format recommended jobs collection into a plain array.
     */
    private function formatRecommendedJobs($jobs): array
    {
        if (!$jobs) return [];

        $items = $jobs instanceof \Illuminate\Support\Collection ? $jobs : collect($jobs);

        return $items->map(function ($job) {
            $j = is_array($job) ? (object) $job : $job;
            return [
                'id'           => $j->id ?? null,
                'title'        => $j->title ?? '',
                'company'      => $j->company ?? '',
                'location'     => $j->location ?? '',
                'source'       => $j->source ?? '',
                'url'          => $j->url ?? '#',
                'job_type'     => $j->job_type ?? '',
                'salary_range' => $j->salary_range ?? '',
            ];
        })->values()->toArray();
    }

    /**
     * Get match level based on percentage.
     */
    private function getMatchLevel(float $percentage): string
    {
        if ($percentage >= 90) return 'Strong Match';
        if ($percentage >= 75) return 'Good Match';
        if ($percentage >= 60) return 'Fair Match';
        if ($percentage >= 40) return 'Moderate Gap';
        return 'Large Gap';
    }
}
