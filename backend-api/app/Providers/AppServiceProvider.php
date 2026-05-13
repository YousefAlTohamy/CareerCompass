<?php

namespace App\Providers;

use App\Services\Contracts\CvProcessingServiceInterface;
use App\Services\Contracts\GapAnalysisServiceInterface;
use App\Services\CvProcessingService;
use App\Services\GapAnalysisService;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(CvProcessingServiceInterface::class, CvProcessingService::class);
        $this->app->bind(GapAnalysisServiceInterface::class, GapAnalysisService::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('api', function (Request $request) {
            $actor = $request->user()?->getAuthIdentifier() ?: $request->ip();

            return [
                Limit::perMinute(120)->by('api:' . $actor),
            ];
        });

        RateLimiter::for('login', function (Request $request) {
            $email = mb_strtolower((string) $request->input('email', 'guest'));

            return [
                Limit::perMinute(5)->by('login:' . $email . '|' . $request->ip()),
                Limit::perHour(30)->by('login-hour:' . $request->ip()),
            ];
        });

        RateLimiter::for('uploads', function (Request $request) {
            $actor = $request->user()?->getAuthIdentifier() ?: $request->ip();

            return [
                Limit::perMinute(6)->by('uploads:' . $actor),
                Limit::perHour(30)->by('uploads-hour:' . $actor),
            ];
        });

        RateLimiter::for('scraper', function (Request $request) {
            $fingerprint = sha1((string) $request->header('X-Scraper-Token', $request->ip()));

            return [
                Limit::perMinute(60)->by('scraper:' . $fingerprint),
            ];
        });

        RateLimiter::for('monitoring', function (Request $request) {
            $fingerprint = sha1((string) $request->bearerToken() . '|' . $request->ip());

            return [
                Limit::perMinute(120)->by('monitoring:' . $fingerprint),
            ];
        });
    }
}
