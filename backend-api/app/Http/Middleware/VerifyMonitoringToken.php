<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyMonitoringToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = (string) config('observability.metrics_token', '');

        if ($expected === '') {
            abort_if(app()->environment('production'), 503, 'Monitoring token is not configured.');
            return $next($request);
        }

        $provided = (string) ($request->bearerToken() ?: $request->headers->get('X-Monitoring-Token', ''));

        if ($provided === '' || !hash_equals($expected, $provided)) {
            abort(401, 'Invalid monitoring token.');
        }

        return $next($request);
    }
}
