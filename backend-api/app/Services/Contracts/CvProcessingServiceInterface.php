<?php

declare(strict_types=1);

namespace App\Services\Contracts;

use App\Models\Skill;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\UploadedFile;

interface CvProcessingServiceInterface
{
    /**
     * Process the uploaded CV.
     *
     * @param UploadedFile $file
     * @param User $user
     * @return array{aiData: array<string, mixed>, syncedSkills: Collection<int, Skill>|array, isNewRole: bool, domain: string|null}
     *
     * @throws \Illuminate\Http\Client\ConnectionException
     * @throws \RuntimeException
     * @throws \Exception
     */
    public function processCv(UploadedFile $file, User $user): array;
}
