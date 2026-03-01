<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class IsAdmin
{
    /**
     * Handle an incoming request.
     * Only allows users with role = 'admin' to proceed.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (!auth('sanctum')->check() || $request->user()->role !== 'admin') {
            abort(403, 'Forbidden: Admins only.');
        }

        return $next($request);
    }
}
