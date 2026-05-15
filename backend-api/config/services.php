<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // Unified AI Engine.
    // Local default: http://127.0.0.1:8002
    // Docker override: http://ai-cv-analyzer:8000
    'ai_engine' => [
        'url'     => env('AI_ENGINE_URL', env('AI_CV_ANALYZER_URL', 'http://127.0.0.1:8002')),
        'timeout' => env('AI_ENGINE_TIMEOUT', 120),
    ],

    // Alias — GapAnalysisService references this key
    'ai_orchestrator' => [
        'url'     => env('AI_ENGINE_URL', env('AI_CV_ANALYZER_URL', 'http://127.0.0.1:8002')),
        'timeout' => env('AI_ENGINE_TIMEOUT', 120),
    ],

    // Alias — CvController references this key
    'ai_gateway' => [
        'url'     => env('AI_ENGINE_URL', env('AI_CV_ANALYZER_URL', 'http://127.0.0.1:8002')),
    ],

    // CV Analyzer direct reference (same service)
    'ai_cv_analyzer' => [
        'url'     => env('AI_ENGINE_URL', env('AI_CV_ANALYZER_URL', 'http://127.0.0.1:8002')),
        'timeout' => env('AI_ENGINE_TIMEOUT', 120),
    ],

    // Scraper service (Laravel -> ai-job-miner HTTP API)
    'scraper_service' => [
        'url'              => env('SCRAPER_SERVICE_URL', 'http://127.0.0.1:8003'),
        'timeout'          => env('SCRAPER_SERVICE_TIMEOUT', 600),
        'token'            => env('SCRAPER_SERVICE_TOKEN', env('SCRAPY_API_TOKEN')),
        'callback_base_url' => env(
            'LARAVEL_INTERNAL_API_URL',
            rtrim(env('APP_URL', 'http://127.0.0.1:8000'), '/') . '/api'
        ),
    ],

    // Scrapy Integration (Python scraper -> Laravel internal API)
    'scrapy' => [
        'token' => env('SCRAPY_API_TOKEN'),
    ],

    'scraping_sources' => [
        'adzuna_app_id' => env('ADZUNA_APP_ID'),
        'adzuna_app_key' => env('ADZUNA_APP_KEY'),
        'use_proxies' => env('SCRAPER_USE_PROXIES', true),
        'rate_limit_per_minute' => env('SCRAPER_RATE_LIMIT_PER_MINUTE', 600),
    ],

];
