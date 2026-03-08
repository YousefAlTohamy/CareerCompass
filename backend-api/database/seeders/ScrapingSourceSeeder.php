<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ScrapingSourceSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * NOTE: Column names match the actual migration schema:
     *   endpoint   (not url_endpoint)
     *   type       (not source_type) — values: 'api' | 'html'  (lowercase)
     *   status     — values: 'active' | 'inactive'             (lowercase)
     *   headers    (JSON, nullable) — HTTP request headers
     *   params     (JSON, nullable) — query-string / API key params
     */
    public function run(): void
    {
        Schema::disableForeignKeyConstraints();
        DB::table('scraping_sources')->truncate();
        Schema::enableForeignKeyConstraints();

        $sources = [
            // ── 1. Wuzzuf HTML board ─────────────────────────────────────────────
            [
                'name'       => 'Wuzzuf Laravel Jobs',
                'endpoint'   => 'https://wuzzuf.net/search/jobs/',
                'type'       => 'html',
                'status'     => 'active',
                'headers'    => null,
                'params'     => json_encode(['q' => 'laravel developer', 'a' => 'hpb']),
                'created_at' => now(),
                'updated_at' => now(),
            ],

            // ── 2. Remotive (free public API, no credentials required) ──────────
            [
                'name'       => 'Remotive Software Dev Jobs',
                'endpoint'   => 'https://remotive.com/api/remote-jobs',
                'type'       => 'api',
                'status'     => 'active',
                'headers'    => null,
                'params'     => json_encode(['candidate_area' => 'Middle East']),
                'created_at' => now(),
                'updated_at' => now(),
            ],

            // ── 3. Adzuna US (credentials loaded from ai-engine/.env) ───────
            [
                'name'       => 'Adzuna US Tech Jobs',
                'endpoint'   => 'https://api.adzuna.com/v1/api/jobs/us/search/1',
                'type'       => 'api',
                'status'     => 'active',
                'headers'    => null,
                'params'     => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],

            // ── 4. LinkedIn Egypt/MENA ──────────────────────────────────────────
            [
                'name'       => 'LinkedIn Egypt/MENA',
                'endpoint'   => 'https://www.linkedin.com/jobs/search',
                'type'       => 'html',
                'status'     => 'active',
                'headers'    => json_encode([
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                ]),
                'params'     => json_encode([
                    'job_query_param' => 'keywords',
                    'location_query_param' => 'location',
                    'default_location' => 'Egypt'
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];

        DB::table('scraping_sources')->insert($sources);
    }
}
