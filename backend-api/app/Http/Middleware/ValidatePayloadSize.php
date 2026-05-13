<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ValidatePayloadSize
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            return $next($request);
        }

        $maxBytes = (int) config('observability.max_json_payload_bytes', 1048576);
        $contentLength = (int) ($request->headers->get('Content-Length') ?? '0');

        if ($request->isJson() && $contentLength > $maxBytes) {
            return response()->json([
                'success' => false,
                'message' => 'Request payload is too large.',
                'request_id' => app()->bound('request.id') ? app('request.id') : null,
            ], 413);
        }

        return $next($request);
    }
}
