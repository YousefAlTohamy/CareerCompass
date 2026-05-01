<?php

namespace Database\Seeders;

use App\Models\ScrapingProxy;
use Illuminate\Database\Seeder;

class ScrapingProxySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $proxies = [
            [
                'host' => '185.199.229.156',
                'port' => '7492',
                'protocol' => 'http',
                'is_active' => true,
            ],
            [
                'host' => '45.152.188.241',
                'port' => '3128',
                'protocol' => 'http',
                'is_active' => true,
            ],
            [
                'host' => '103.152.112.162',
                'port' => '80',
                'protocol' => 'http',
                'is_active' => true,
            ],
            [
                'host' => '51.158.154.173',
                'port' => '3128',
                'protocol' => 'https',
                'is_active' => true,
            ],
            [
                'host' => '20.210.113.32',
                'port' => '80',
                'protocol' => 'https',
                'is_active' => true,
            ],
            [
                'host' => '160.86.242.23',
                'port' => '8080',
                'protocol' => 'http',
                'is_active' => true,
            ],
            [
                'host' => '34.23.45.223',
                'port' => '8888',
                'protocol' => 'http',
                'is_active' => true,
            ],
            [
                'host' => '190.61.88.147',
                'port' => '8080',
                'protocol' => 'https',
                'is_active' => true,
            ],
        ];

        foreach ($proxies as $proxy) {
            ScrapingProxy::updateOrCreate(
                ['host' => $proxy['host'], 'port' => $proxy['port']],
                $proxy
            );
        }

        $this->command->info('Scraping proxies seeded successfully.');
    }
}
