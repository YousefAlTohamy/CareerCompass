<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\CvAnalysis;
use App\Services\CvStorageService;
use Illuminate\Console\Command;

class CleanupCvUploads extends Command
{
    protected $signature = 'cv:cleanup-uploads {--dry-run : Count eligible CV files without deleting them}';

    protected $description = 'Delete stored CV upload objects after the configured retention period.';

    public function handle(CvStorageService $storageService): int
    {
        $retentionDays = max(1, (int) config('filesystems.cv_uploads.retention_days', 365));
        $cutoff = now()->subDays($retentionDays);
        $dryRun = (bool) $this->option('dry-run');
        $deleted = 0;

        CvAnalysis::query()
            ->whereNotNull('cv_path')
            ->whereNotNull('cv_uploaded_at')
            ->where('cv_uploaded_at', '<', $cutoff)
            ->orderBy('id')
            ->chunkById(100, function ($analyses) use ($storageService, $dryRun, &$deleted): void {
                foreach ($analyses as $analysis) {
                    if (!$dryRun) {
                        $storageService->delete($analysis->cv_disk, $analysis->cv_path);
                        $analysis->forceFill([
                            'cv_disk' => null,
                            'cv_path' => null,
                            'cv_original_name' => null,
                            'cv_mime' => null,
                            'cv_size' => null,
                            'cv_sha256' => null,
                            'cv_uploaded_at' => null,
                        ])->save();
                    }

                    $deleted++;
                }
            });

        $this->info(($dryRun ? 'Eligible CV uploads: ' : 'Deleted CV uploads: ') . $deleted);

        return self::SUCCESS;
    }
}
