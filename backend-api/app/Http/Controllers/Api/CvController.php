<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CvUploadRequest;
use App\Http\Resources\SkillResource;
use App\Http\Resources\UserResource;
use App\Models\CvAnalysis;
use App\Models\User;
use App\Services\Contracts\CvProcessingServiceInterface;
use App\Services\CvStorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CvController extends Controller
{
    private CvProcessingServiceInterface $cvService;

    public function __construct(CvProcessingServiceInterface $cvService)
    {
        $this->cvService = $cvService;
    }

    /**
     * Upload a CV, send it to the AI Gateway, persist the results,
     * and trigger self-expanding role discovery when needed.
     *
     * POST /api/cv/upload
     */
    public function upload(CvUploadRequest $request): JsonResponse
    {
        // Prevent PHP from killing the script during heavy ML processing (OCR, NER)
        set_time_limit(240);

        /** @var User $user */
        $user = $request->user();

        try {
            /** @var UploadedFile $cvFile */
            $cvFile = $request->file('cv');

            $result = $this->cvService->processCv($cvFile, $user);

            // Return unified response with full user data via UserResource
            $user->refresh()->load(['profile', 'experiences', 'skills', 'cvAnalysis']);

            $userData = (new UserResource($user))->toArray($request);
            $userData['domain_confidence'] = $result['aiData']['domain_confidence'] ?? null;
            $userData['extraction_method'] = $result['aiData']['extraction_method'] ?? null;
            $parsingStatus = (string) ($result['aiData']['parsing_status'] ?? 'success');
            $warnings = $this->buildUploadWarnings($parsingStatus, $result['aiData']);
            $message = match ($parsingStatus) {
                'timeout' => 'CV uploaded, but AI analysis timed out. Existing profile details were preserved.',
                'error' => 'CV uploaded, but AI analysis returned an error. Existing profile details were preserved.',
                'empty_file', 'no_text' => 'CV uploaded, but no readable text could be extracted. Existing profile details were preserved.',
                'ocr_fallback' => 'CV parsed using OCR fallback. Please review the extracted profile details.',
                'partial_success' => 'CV uploaded with partial analysis. Please review the extracted profile details.',
                default => 'CV parsed successfully.',
            };
            $responseData = $this->buildUploadResponseData($user, $result['aiData'], $warnings, $parsingStatus);

            Log::info('CV upload processed via AI Gateway', [
                'user_id'     => $user->id,
                'domain'      => $result['domain'],
                'skills'      => count($result['syncedSkills']),
                'is_new_role' => $result['isNewRole'],
                'parsing_status' => $parsingStatus,
            ]);

            return response()->json([
                'success'     => true,
                'message'     => $message,
                'data'        => $responseData,
                'parsing_status' => $parsingStatus,
                'warnings'    => $warnings,
                'analysis_id' => $responseData['analysis_id'],
                'skills_count' => $responseData['skills_count'],
                'predicted_role' => $responseData['predicted_role'],
                'profile_updated' => $responseData['profile_updated'],
                'retry_available' => $responseData['retry_available'],
                'download_url' => $responseData['download_url'],
                'is_new_role' => $result['isNewRole'],
                'user'        => $userData,
                'skills'      => SkillResource::collection(
                    $user->skills()->orderBy('name')->get()
                ),
            ]);
        } catch (ConnectionException $e) {
            Log::error('AI Gateway unreachable', [
                'user_id' => $user->id,
                'url'     => config('services.ai_cv_analyzer.url', 'http://127.0.0.1:8002'),
                'error_class' => $e::class,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'The AI engine is currently unavailable. Please try again in a moment.',
                'data' => $this->buildFailureResponseData('error', [
                    [
                        'code' => 'ai_unavailable',
                        'message' => 'The AI engine could not be reached. No profile data was changed.',
                    ],
                ]),
                'parsing_status' => 'error',
                'warnings' => [
                    [
                        'code' => 'ai_unavailable',
                        'message' => 'The AI engine could not be reached. No profile data was changed.',
                    ],
                ],
                'retry_available' => true,
            ], 503);
        } catch (\Exception $e) {
            Log::error('CV upload failed', [
                'user_id' => $user->id,
                'error_class' => $e::class,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An error occurred while processing your CV.',
                'data' => $this->buildFailureResponseData('error', [
                    [
                        'code' => 'cv_processing_failed',
                        'message' => 'The upload could not be completed. No profile data was changed.',
                    ],
                ]),
                'parsing_status' => 'error',
                'warnings' => [
                    [
                        'code' => 'cv_processing_failed',
                        'message' => 'The upload could not be completed. No profile data was changed.',
                    ],
                ],
                'retry_available' => true,
                'error_code' => 'cv_processing_failed',
            ], 500);
        }
    }

    /**
     * @param array<string, mixed> $aiData
     * @return array<int, array{code: string, message: string}>
     */
    private function buildUploadWarnings(string $parsingStatus, array $aiData): array
    {
        $warnings = [];

        if ($parsingStatus === 'timeout') {
            $warnings[] = [
                'code' => 'ai_timeout',
                'message' => 'The AI engine timed out before completing analysis.',
            ];
        } elseif ($parsingStatus === 'error') {
            $warnings[] = [
                'code' => 'ai_error',
                'message' => 'The AI engine returned an error during analysis.',
            ];
        } elseif (in_array($parsingStatus, ['empty_file', 'no_text'], true)) {
            $warnings[] = [
                'code' => 'no_readable_text',
                'message' => 'No readable CV text could be extracted from the uploaded file.',
            ];
        } elseif ($parsingStatus === 'ocr_fallback') {
            $warnings[] = [
                'code' => 'ocr_fallback',
                'message' => 'The CV was analyzed using OCR fallback and may need manual review.',
            ];
        } elseif ($parsingStatus === 'partial_success') {
            $warnings[] = [
                'code' => 'partial_analysis',
                'message' => 'The AI engine returned a partial analysis. Please review the extracted details.',
            ];
        }

        $aiWarnings = is_array($aiData['warnings'] ?? null) ? $aiData['warnings'] : [];
        foreach ($aiWarnings as $warning) {
            if (!is_array($warning)) {
                continue;
            }

            $code = isset($warning['code']) ? (string) $warning['code'] : null;
            $message = isset($warning['message']) ? (string) $warning['message'] : null;
            if ($code !== null && $message !== null) {
                $warnings[] = ['code' => $code, 'message' => $message];
            }
        }

        $skills = $aiData['skills'] ?? [];
        if (!in_array($parsingStatus, ['timeout', 'error', 'empty_file', 'no_text'], true) && is_array($skills) && count(array_filter($skills)) === 0) {
            $warnings[] = [
                'code' => 'no_skills_extracted',
                'message' => 'No skills were extracted, so existing skills were preserved.',
            ];
        }

        return $warnings;
    }

    /**
     * @param array<string, mixed> $aiData
     * @param array<int, array{code: string, message: string}> $warnings
     * @return array<string, mixed>
     */
    private function buildUploadResponseData(User $user, array $aiData, array $warnings, string $parsingStatus): array
    {
        $analysis = $user->cvAnalysis;
        $skillsCount = $user->skills()->count();
        $downloadUrl = null;

        if ($analysis !== null && $analysis->cv_path !== null) {
            try {
                $downloadUrl = app(CvStorageService::class)->temporaryDownloadUrl($analysis);
            } catch (\Throwable) {
                $downloadUrl = null;
            }
        }

        $structuredProfileUpdated = !in_array($parsingStatus, ['timeout', 'error', 'empty_file', 'no_text'], true);

        return [
            'analysis_id' => $analysis?->id,
            'parsing_status' => $parsingStatus,
            'warnings' => $warnings,
            'skills_count' => $skillsCount,
            'predicted_role' => $analysis?->predicted_role ?? ($aiData['predicted_role'] ?? null),
            'profile_updated' => $structuredProfileUpdated,
            'retry_available' => in_array($parsingStatus, ['timeout', 'error', 'empty_file', 'no_text'], true),
            'download_url' => $downloadUrl,
        ];
    }

    /**
     * @param array<int, array{code: string, message: string}> $warnings
     * @return array<string, mixed>
     */
    private function buildFailureResponseData(string $parsingStatus, array $warnings): array
    {
        return [
            'analysis_id' => null,
            'parsing_status' => $parsingStatus,
            'warnings' => $warnings,
            'skills_count' => null,
            'predicted_role' => null,
            'profile_updated' => false,
            'retry_available' => true,
            'download_url' => null,
        ];
    }

    /**
     * Get the current user's skills.
     *
     * GET /api/cv/skills
     */
    public function getUserSkills(): JsonResponse
    {
        $user   = request()->user();
        $skills = $user->skills;

        return response()->json([
            'success' => true,
            'data'    => [
                'total'     => $skills->count(),
                'technical' => $skills->where('type', 'technical')->count(),
                'soft'      => $skills->where('type', 'soft')->count(),
                'skills'    => SkillResource::collection($skills),
            ],
        ]);
    }

    /**
     * Remove a skill from the user's profile.
     *
     * DELETE /api/cv/skills/{skillId}
     */
    public function removeSkill(int $skillId): JsonResponse
    {
        $user  = request()->user();
        $skill = $user->skills()->find($skillId);

        if (!$skill) {
            return response()->json([
                'success' => false,
                'message' => 'Skill not found in your profile.',
            ], 404);
        }

        $user->skills()->detach($skillId);

        Log::info('Skill removed from user profile', [
            'user_id'    => $user->id,
            'skill_id'   => $skillId,
            'skill_name' => $skill->name,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Skill removed successfully.',
        ]);
    }

    public function downloadUrl(CvStorageService $storageService): JsonResponse
    {
        $analysis = request()->user()->cvAnalysis;

        if (!$analysis || !$analysis->cv_path) {
            return response()->json([
                'success' => false,
                'message' => 'No stored CV is available.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'url' => $storageService->temporaryDownloadUrl($analysis),
                'expires_at' => now()
                    ->addMinutes((int) config('filesystems.cv_uploads.temporary_url_minutes', 10))
                    ->toIso8601String(),
            ],
        ]);
    }

    public function download(CvAnalysis $cvAnalysis): StreamedResponse
    {
        if (!$cvAnalysis->cv_disk || !$cvAnalysis->cv_path) {
            abort(404);
        }

        $disk = Storage::disk($cvAnalysis->cv_disk);
        if (!$disk->exists($cvAnalysis->cv_path)) {
            abort(404);
        }

        return $disk->download(
            $cvAnalysis->cv_path,
            $cvAnalysis->cv_original_name ?: 'career-compass-cv'
        );
    }
}
