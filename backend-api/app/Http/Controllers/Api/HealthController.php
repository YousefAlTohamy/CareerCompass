<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class HealthController extends Controller
{
    public function live(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'status' => 'ok',
            'service' => 'CareerCompass API',
            'request_id' => app()->bound('request.id') ? app('request.id') : null,
        ]);
    }

    public function ready(): JsonResponse
    {
        $checks = [
            'database' => $this->databaseReady(),
            'cache' => $this->cacheReady(),
            'ai' => $this->httpReady(rtrim((string) config('services.ai_engine.url'), '/')),
            'scraper' => $this->httpReady(rtrim((string) config('services.scraper_service.url'), '/') . '/health'),
        ];

        $ready = collect($checks)->every(fn (array $check) => $check['ok']);

        return response()->json([
            'success' => $ready,
            'status' => $ready ? 'ready' : 'degraded',
            'checks' => $checks,
            'request_id' => app()->bound('request.id') ? app('request.id') : null,
        ], $ready ? 200 : 503);
    }

    private function databaseReady(): array
    {
        try {
            DB::select('select 1');
            return ['ok' => true];
        } catch (\Throwable $e) {
            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }

    private function cacheReady(): array
    {
        try {
            Cache::put('health:ready', true, 10);
            return ['ok' => Cache::has('health:ready')];
        } catch (\Throwable $e) {
            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }

    private function httpReady(string $url): array
    {
        if ($url === '') {
            return ['ok' => false, 'error' => 'not_configured'];
        }

        try {
            $response = Http::timeout(3)
                ->withHeaders($this->correlationHeaders())
                ->get($url);

            return [
                'ok' => $response->successful() || $response->status() === 404,
                'status' => $response->status(),
            ];
        } catch (\Throwable $e) {
            return ['ok' => false, 'error' => $e->getMessage()];
        }
    }

    private function correlationHeaders(): array
    {
        return app()->bound('request.id')
            ? [(string) config('observability.request_id_header', 'X-Request-ID') => app('request.id')]
            : [];
    }
}
