<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class ScraperClient
{
    public function scrape(string $query, int $limit, int $scrapingJobId, ?int $sourceId = null): array
    {
        $baseUrl = rtrim((string) config('services.scraper_service.url'), '/');
        $token = (string) config('services.scraper_service.token', '');
        $timeout = (int) config('services.scraper_service.timeout', 600);

        if ($token === '') {
            throw new RuntimeException('SCRAPER_SERVICE_TOKEN is not configured.');
        }

        $payload = [
            'query' => $query,
            'limit' => min(max($limit, 1), 100),
            'scraping_job_id' => $scrapingJobId,
            'callback_base_url' => config('services.scraper_service.callback_base_url'),
        ];

        if ($sourceId !== null) {
            $payload['source_id'] = $sourceId;
        }

        try {
            $response = Http::acceptJson()
                ->asJson()
                ->withHeader('X-Scraper-Service-Token', $token)
                ->withHeaders($this->correlationHeaders())
                ->connectTimeout(10)
                ->timeout($timeout)
                ->retry(2, 1000, throw: false)
                ->post("{$baseUrl}/scrape", $payload);
        } catch (ConnectionException $e) {
            Log::error('Scraper service connection failed', [
                'url' => "{$baseUrl}/scrape",
                'query' => $query,
                'error' => $e->getMessage(),
            ]);

            throw new RuntimeException('The scraper service is unavailable.', previous: $e);
        }

        $data = $response->json();
        if (!$response->successful() || !is_array($data) || ($data['success'] ?? false) !== true) {
            Log::error('Scraper service returned a failed response', [
                'status' => $response->status(),
                'body' => $response->body(),
                'query' => $query,
                'source_id' => $sourceId,
            ]);

            throw new RuntimeException('Scraper execution failed: ' . mb_substr($response->body(), 0, 1000));
        }

        return $data;
    }

    private function correlationHeaders(): array
    {
        return app()->bound('request.id')
            ? [(string) config('observability.request_id_header', 'X-Request-ID') => app('request.id')]
            : [];
    }
}
