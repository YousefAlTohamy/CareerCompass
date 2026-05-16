<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\ScrapingSource;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class ScraperClient
{
    public function scrape(
        string $query,
        int $limit,
        int $scrapingJobId,
        ?int $sourceId = null,
        bool $allowFailure = false
    ): array
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
            $payload['source'] = $this->sourcePayload($sourceId);
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
        if (!$response->successful() || !is_array($data) || (!$allowFailure && ($data['success'] ?? false) !== true)) {
            Log::error('Scraper service returned a failed response', [
                'status' => $response->status(),
                'body' => $this->redactText($response->body()),
                'query' => $query,
                'source_id' => $sourceId,
            ]);

            throw new RuntimeException('Scraper execution failed: ' . mb_substr($response->body(), 0, 1000));
        }

        return $data;
    }

    private function sourcePayload(int $sourceId): ?array
    {
        $source = ScrapingSource::find($sourceId);

        if (!$source) {
            return null;
        }

        $support = $source->supportMetadata();

        return [
            'id' => $source->id,
            'name' => $source->name,
            'source_name' => $source->name,
            'type' => $source->type,
            'source_type' => $source->type,
            'endpoint' => $source->endpoint,
            'method' => $source->method ?? 'GET',
            'headers' => $this->normalizeSourceMap($source->headers ?? []),
            'params' => $this->normalizeSourceMap($source->params ?? []),
            'mode' => $source->mode ?? 'static',
            'pattern' => $source->pattern,
            'adapter_name' => $support['adapter_name'] ?? $source->adapterName(),
            'adapter_mode' => $support['adapter_mode'] ?? 'adapter_missing',
            'support_status' => $support['support_status'] ?? 'unknown',
            'requires_credentials' => (bool) ($support['requires_credentials'] ?? false),
            'requires_proxy' => (bool) ($support['requires_proxy'] ?? false),
        ];
    }

    private function normalizeSourceMap(mixed $value): object|array
    {
        if (empty($value)) {
            return (object) [];
        }

        if (is_object($value)) {
            return $value;
        }

        if (!is_array($value) || array_is_list($value)) {
            return (object) [];
        }

        return $value;
    }

    private function correlationHeaders(): array
    {
        return app()->bound('request.id')
            ? [(string) config('observability.request_id_header', 'X-Request-ID') => app('request.id')]
            : [];
    }

    private function redactText(string $value): string
    {
        $redacted = $value;
        foreach (['ADZUNA_APP_ID', 'ADZUNA_APP_KEY', 'SCRAPER_SERVICE_TOKEN', 'SCRAPY_API_TOKEN'] as $envKey) {
            $secret = (string) env($envKey, '');
            if ($secret !== '') {
                $redacted = str_replace($secret, '[redacted]', $redacted);
            }
        }

        return preg_replace('/([?&](?:app_id|app_key|api_key|token)=)[^&\s"]+/i', '$1[redacted]', $redacted) ?? $redacted;
    }
}
