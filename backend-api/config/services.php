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

    // Unified AI Engine (ai-cv-analyzer on Port 8002)
    // Handles: CV parsing, hybrid matching, health checks
    'ai_engine' => [
        'url'     => env('AI_ENGINE_URL', 'http://127.0.0.1:8002'),
        'timeout' => env('AI_ENGINE_TIMEOUT', 120),
    ],

    // Alias — GapAnalysisService references this key
    'ai_orchestrator' => [
        'url'     => env('AI_ENGINE_URL', 'http://127.0.0.1:8002'),
        'timeout' => env('AI_ENGINE_TIMEOUT', 120),
    ],

    // Alias — CvController references this key
    'ai_gateway' => [
        'url'     => env('AI_ENGINE_URL', 'http://127.0.0.1:8002'),
    ],

    // CV Analyzer direct reference (same service)
    'ai_cv_analyzer' => [
        'url'     => env('AI_ENGINE_URL', 'http://127.0.0.1:8002'),
        'timeout' => env('AI_ENGINE_TIMEOUT', 120),
    ],

    // Scrapy Integration (Python Scraper Token)
    'scrapy' => [
        'token' => env('SCRAPY_API_TOKEN'),
    ],

];
