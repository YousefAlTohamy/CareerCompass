<?php

declare(strict_types=1);

namespace App\Services\Contracts;

use App\Models\Job;
use App\Models\User;
use Illuminate\Support\Collection;

interface GapAnalysisServiceInterface
{
    /**
     * Perform weighted gap analysis between a user and a job.
     *
     * @param User $user
     * @param Job $job
     * @return array<string, mixed>
     */
    public function performGapAnalysis(User $user, Job $job): array;

    /**
     * Persist the CV-extracted job title and matched skills to the user's profile.
     *
     * @param User $user
     * @param string|null $jobTitle
     * @param iterable|mixed $matchedSkills
     */
    public function persistUserProfile(User $user, ?string $jobTitle, $matchedSkills): void;

    /**
     * Find recommended jobs that match the detected job title.
     * Excludes the current job being analyzed.
     *
     * @param string|null $jobTitle
     * @param int $excludeJobId
     * @return Collection|\Illuminate\Database\Eloquent\Collection
     */
    public function findRecommendedJobs(?string $jobTitle, int $excludeJobId);

    /**
     * Get recommendations efficiently mapped via a single DB query.
     *
     * @param User $user
     * @return array<string, mixed>
     */
    public function getRecommendations(User $user): array;
}
