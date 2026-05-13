<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HealthAndMetricsTest extends TestCase
{
    use RefreshDatabase;

    public function test_health_endpoints_return_request_id_and_ready_state(): void
    {
        $this->withHeader('X-Request-ID', 'req-health-001')
            ->getJson('/api/v1/health')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('request_id', 'req-health-001');

        $this->getJson('/api/v1/ready')
            ->assertStatus(503)
            ->assertJsonStructure(['success', 'status', 'checks', 'request_id']);
    }

    public function test_metrics_endpoint_requires_machine_token(): void
    {
        config(['observability.metrics_token' => 'metrics-secret']);

        $this->get('/api/v1/metrics')
            ->assertUnauthorized();

        $this->withToken('metrics-secret')
            ->get('/api/v1/metrics')
            ->assertOk()
            ->assertHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
            ->assertSee('career_compass_app_info', false);
    }
}
