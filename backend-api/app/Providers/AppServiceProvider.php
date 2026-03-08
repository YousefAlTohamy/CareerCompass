<?php

namespace App\Providers;

use App\Services\Contracts\CvProcessingServiceInterface;
use App\Services\Contracts\GapAnalysisServiceInterface;
use App\Services\CvProcessingService;
use App\Services\GapAnalysisService;
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
        //
    }
}
