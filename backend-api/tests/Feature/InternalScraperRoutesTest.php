<?php

namespace Tests\Feature;

use App\Models\ScrapingProxy;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InternalScraperRoutesTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_tokens_cannot_access_internal_proxy_credentials(): void
    {
        config(['services.scrapy.token' => 'scraper-secret']);

        ScrapingProxy::create([
            'host' => 'proxy.local',
            'port' => '8080',
            'username' => 'private-user',
            'password' => 'private-pass',
            'protocol' => 'http',
            'is_active' => true,
        ]);

        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/v1/proxies/active')
            ->assertUnauthorized();
    }

    public function test_scraper_machine_token_can_read_active_proxy_credentials(): void
    {
        config(['services.scrapy.token' => 'scraper-secret']);

        ScrapingProxy::create([
            'host' => 'proxy.local',
            'port' => '8080',
            'username' => 'private-user',
            'password' => 'private-pass',
            'protocol' => 'http',
            'is_active' => true,
        ]);

        ScrapingProxy::create([
            'host' => 'inactive.local',
            'port' => '8080',
            'protocol' => 'http',
            'is_active' => false,
        ]);

        $this->withToken('scraper-secret')
            ->getJson('/api/v1/proxies/active')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.username', 'private-user')
            ->assertJsonPath('data.0.password', 'private-pass');
    }
}
