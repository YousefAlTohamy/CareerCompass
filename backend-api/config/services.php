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

    'ai_engine' => [
        'url'     => env('AI_ENGINE_URL', 'http://127.0.0.1:8001'),
        'timeout' => env('AI_ENGINE_TIMEOUT', 120),
    ],

    // AI Gateway (legacy alias) — defaults to orchestrator
    'ai_gateway' => [
        'url'     => env('AI_GATEWAY_URL', env('AI_ORCHESTRATOR_URL', 'http://127.0.0.1:8001')),
        'timeout' => env('AI_GATEWAY_TIMEOUT', 120),
    ],

    // ai-cv-analyzer (port 8002) — /api/v3/analyze-cv, /api/v2/match-job, /api/v2/analyze-cv
    'ai_cv_analyzer' => [
        'url'     => env('AI_CV_ANALYZER_URL', 'http://127.0.0.1:8002'),
        'timeout' => env('AI_CV_ANALYZER_TIMEOUT', 120),
    ],

    // ai-hybrid-orchestrator (port 8001) — /api/v1/parse-cv, /api/v1/scrape-on-demand, /scrape-jobs
    'ai_orchestrator' => [
        'url'     => env('AI_ORCHESTRATOR_URL', 'http://127.0.0.1:8001'),
        'timeout' => env('AI_ORCHESTRATOR_TIMEOUT', 120),
    ],

];
