<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class LogApiRequests
{
    public function handle(Request $request, Closure $next): Response
    {
        $startedAt = microtime(true);

        /** @var Response $response */
        $response = $next($request);

        $durationMs = (int) round((microtime(true) - $startedAt) * 1000);
        $level = $response->getStatusCode() >= 500 || $durationMs >= (int) config('observability.slow_request_ms', 1000)
            ? 'warning'
            : 'info';

        Log::log($level, 'api.request.completed', [
            'status' => $response->getStatusCode(),
            'duration_ms' => $durationMs,
            'user_id' => $request->user()?->id,
            'route' => optional($request->route())->getName(),
            'request_id' => app()->bound('request.id') ? app('request.id') : null,
            'fingerprint' => $this->safeFingerprint($request),
        ]);

        return $response;
    }

    private function safeFingerprint(Request $request): ?string
    {
        try {
            return $request->fingerprint();
        } catch (\Throwable) {
            return null;
        }
    }
}
