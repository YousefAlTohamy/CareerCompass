<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Application;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class ApplicationTrackerService
{
    public function listForUser(User $user): Collection
    {
        return $user->applications()
            ->with('job.skills')
            ->latest()
            ->get();
    }

    public function createOrUpdate(User $user, array $data): Application
    {
        return DB::transaction(function () use ($user, $data): Application {
            $application = $user->applications()->updateOrCreate(
                ['job_id' => $data['job_id']],
                [
                    'status' => $data['status'] ?? 'saved',
                    'notes' => $data['notes'] ?? null,
                    'applied_at' => ($data['status'] ?? 'saved') === 'applied' ? now() : null,
                ]
            );

            return $application->load('job.skills');
        });
    }

    public function update(Application $application, array $data): Application
    {
        $application->update($data);

        if (($data['status'] ?? null) === 'applied' && !$application->applied_at) {
            $application->forceFill(['applied_at' => now()])->save();
        }

        return $application->fresh('job.skills');
    }
}
