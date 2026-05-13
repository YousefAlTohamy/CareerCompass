<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyScraperToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = (string) config('services.scrapy.token', '');
        $provided = (string) $request->bearerToken();

        if ($expected === '' || $provided === '' || !hash_equals($expected, $provided)) {
            abort(401, 'Invalid scraper token.');
        }

        return $next($request);
    }
}
