<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\CvAnalysis;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use RuntimeException;

class CvStorageService
{
    /**
     * @return array{disk: string, path: string, original_name: string, mime: string|null, size: int|null, sha256: string, uploaded_at: \Illuminate\Support\Carbon}
     */
    public function store(UploadedFile $file, User $user): array
    {
        $disk = $this->disk();
        $mime = $file->getMimeType();
        $extension = $this->safeExtension($mime, $file->getClientOriginalExtension());
        $prefix = trim((string) config('filesystems.cv_uploads.prefix', 'cv-uploads'), '/');
        $path = sprintf(
            '%s/users/%d/%s/%s.%s',
            $prefix,
            $user->id,
            now()->format('Y/m'),
            (string) Str::uuid(),
            $extension
        );

        $realPath = $file->getRealPath();
        if ($realPath === false) {
            throw new RuntimeException('Unable to read uploaded CV.');
        }

        $stream = fopen($realPath, 'rb');
        if ($stream === false) {
            throw new RuntimeException('Unable to read uploaded CV.');
        }

        try {
            $stored = Storage::disk($disk)->put($path, $stream, [
                'visibility' => 'private',
                'ContentType' => $mime,
            ]);
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }

        if ($stored === false) {
            throw new RuntimeException('Unable to store uploaded CV.');
        }

        $sha256 = hash_file('sha256', $realPath);
        if ($sha256 === false) {
            throw new RuntimeException('Unable to fingerprint uploaded CV.');
        }

        return [
            'disk' => $disk,
            'path' => $path,
            'original_name' => $this->sanitizeOriginalName($file->getClientOriginalName()),
            'mime' => $mime,
            'size' => $file->getSize(),
            'sha256' => $sha256,
            'uploaded_at' => now(),
        ];
    }

    public function delete(?string $disk, ?string $path): void
    {
        if ($disk === null || $path === null || $path === '') {
            return;
        }

        Storage::disk($disk)->delete($path);
    }

    public function temporaryDownloadUrl(CvAnalysis $analysis): string
    {
        if (!$analysis->cv_disk || !$analysis->cv_path) {
            throw new RuntimeException('No CV file is available for this analysis.');
        }

        $expiresAt = now()->addMinutes((int) config('filesystems.cv_uploads.temporary_url_minutes', 10));

        return URL::temporarySignedRoute('api.cv.download', $expiresAt, [
            'cvAnalysis' => $analysis->id,
        ]);
    }

    public function disk(): string
    {
        return (string) config('filesystems.cv_uploads.disk', config('filesystems.default', 'local'));
    }

    private function safeExtension(?string $mime, string $clientExtension): string
    {
        return match ($mime) {
            'application/pdf' => 'pdf',
            'image/jpeg' => in_array(strtolower($clientExtension), ['jpg', 'jpeg'], true) ? strtolower($clientExtension) : 'jpg',
            'image/png' => 'png',
            default => throw new RuntimeException('Unsupported CV file MIME type.'),
        };
    }

    private function sanitizeOriginalName(string $name): string
    {
        $clean = preg_replace('/[^\w.\- ]+/u', '_', $name) ?: 'cv-upload';

        return Str::limit(trim($clean), 255, '');
    }
}
