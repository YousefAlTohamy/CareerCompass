<?php

namespace App\Providers;

use App\Services\Contracts\CvProcessingServiceInterface;
use App\Services\CvProcessingService;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(CvProcessingServiceInterface::class, CvProcessingService::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
