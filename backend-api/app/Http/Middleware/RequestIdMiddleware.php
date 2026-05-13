<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class RequestIdMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $header = (string) config('observability.request_id_header', 'X-Request-ID');
        $requestId = $request->headers->get($header) ?: (string) Str::uuid();

        $request->headers->set($header, $requestId);
        app()->instance('request.id', $requestId);

        Log::withContext([
            'request_id' => $requestId,
            'method' => $request->method(),
            'path' => $request->path(),
            'ip' => $request->ip(),
        ]);

        /** @var Response $response */
        $response = $next($request);
        $response->headers->set($header, $requestId);

        return $response;
    }
}
