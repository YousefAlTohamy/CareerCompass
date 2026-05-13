<?php

return [
    'service_name' => env('OTEL_SERVICE_NAME', 'career-compass-backend'),
    'request_id_header' => env('REQUEST_ID_HEADER', 'X-Request-ID'),
    'metrics_enabled' => env('METRICS_ENABLED', true),
    'metrics_token' => env('MONITORING_TOKEN'),
    'log_request_bodies' => env('LOG_REQUEST_BODIES', false),
    'slow_request_ms' => (int) env('SLOW_REQUEST_MS', 1000),
    'max_json_payload_bytes' => (int) env('MAX_JSON_PAYLOAD_BYTES', 1048576),
];
