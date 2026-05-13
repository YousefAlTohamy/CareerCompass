<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(prepend: [
            \App\Http\Middleware\RequestIdMiddleware::class,
            \App\Http\Middleware\SecureHeaders::class,
            \App\Http\Middleware\ValidatePayloadSize::class,
            \Illuminate\Http\Middleware\HandleCors::class,
        ]);

        $middleware->api(append: [
            \App\Http\Middleware\LogApiRequests::class,
        ]);

        // Register route middleware aliases
        $middleware->alias([
            'admin' => \App\Http\Middleware\IsAdmin::class,
            'scraper.token' => \App\Http\Middleware\VerifyScraperToken::class,
            'monitoring.token' => \App\Http\Middleware\VerifyMonitoringToken::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (\Throwable $e, \Illuminate\Http\Request $request) {
            if (!$request->is('api/*')) {
                return null;
            }

            $status = match (true) {
                $e instanceof \Illuminate\Validation\ValidationException => 422,
                $e instanceof \Illuminate\Auth\AuthenticationException => 401,
                $e instanceof \Illuminate\Auth\Access\AuthorizationException => 403,
                $e instanceof \Symfony\Component\HttpKernel\Exception\NotFoundHttpException => 404,
                $e instanceof \Symfony\Component\HttpKernel\Exception\ThrottleRequestsException => 429,
                $e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface => $e->getStatusCode(),
                default => 500,
            };

            $payload = [
                'success' => false,
                'message' => $e instanceof \Illuminate\Validation\ValidationException
                    ? 'The given data was invalid.'
                    : ($status >= 500 && !config('app.debug') ? 'Server error.' : $e->getMessage()),
                'request_id' => app()->bound('request.id') ? app('request.id') : null,
            ];

            if ($e instanceof \Illuminate\Validation\ValidationException) {
                $payload['errors'] = $e->errors();
            }

            if (config('app.debug') && $status >= 500) {
                $payload['exception'] = $e::class;
            }

            return response()->json($payload, $status);
        });
    })->create();
