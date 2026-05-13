<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ScrapingSourceSeeder extends Seeder
{
    /**
     * Seed global scraping source *templates*.
     *
     * Every endpoint URL uses a {query} placeholder which is dynamically
     * replaced at scraping time with URL-encoded TargetJobRole names
     * (e.g. "Backend Developer" → "Backend%20Developer").
     *
     * Column mapping (matches the actual migration schema):
     *   endpoint   — URL template containing {query}
     *   type       — 'api' | 'html' | 'spa'  (lowercase)
     *   status     — 'active' | 'inactive'    (lowercase)
     *   headers    — JSON, nullable – HTTP request headers
     *   params     — JSON, nullable – extra query-string params
     *   mode       — 'static' | 'discovery'
     */
    public function run(): void
    {
        $sources = [
            // ── 1. LinkedIn — Global job search (SPA, requires JS rendering) ──
            [
                'name'       => 'LinkedIn Global',
                'endpoint'   => 'https://www.linkedin.com/jobs/search/?keywords={query}&location=Worldwide&f_WT=2',
                'type'       => 'spa',
                'status'     => 'active',
                'mode'       => 'discovery',
                'pattern'    => '/jobs/view/\\d+',
                'headers'    => [
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                ],
                'params'     => null,
            ],

            // ── 2. Indeed — Remote job search (SPA, JS-heavy results page) ────
            [
                'name'       => 'Indeed Remote',
                'endpoint'   => 'https://www.indeed.com/jobs?q={query}&l=Remote',
                'type'       => 'spa',
                'status'     => 'active',
                'mode'       => 'discovery',
                'pattern'    => '/viewjob\\?',
                'headers'    => [
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                ],
                'params'     => null,
            ],

            // ── 3. Upwork — Freelance / contract job search (SPA) ─────────────
            [
                'name'       => 'Upwork Global',
                'endpoint'   => 'https://www.upwork.com/nx/search/jobs/?q={query}&sort=recency',
                'type'       => 'spa',
                'status'     => 'active',
                'mode'       => 'discovery',
                'pattern'    => '/jobs/~',
                'headers'    => [
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                ],
                'params'     => null,
            ],

            // ── 4. Remotive — Remote-first API (no auth required) ─────────────
            [
                'name'       => 'Remotive Remote Jobs',
                'endpoint'   => 'https://remotive.com/api/remote-jobs?search={query}',
                'type'       => 'api',
                'status'     => 'active',
                'mode'       => 'static',
                'pattern'    => null,
                'headers'    => null,
                'params'     => null,
            ],

            // ── 5. Adzuna US — Public API (credentials via .env) ──────────────
            [
                'name'       => 'Adzuna US Tech',
                'endpoint'   => 'https://api.adzuna.com/v1/api/jobs/us/search/1?what={query}',
                'type'       => 'api',
                'status'     => 'active',
                'mode'       => 'static',
                'pattern'    => null,
                'headers'    => null,
                'params'     => null,
            ],

            // ── 6. Wuzzuf — Egyptian job board (HTML scraping) ────────────────
            [
                'name'       => 'Wuzzuf Egypt',
                'endpoint'   => 'https://wuzzuf.net/search/jobs/?q={query}&a=hpb',
                'type'       => 'html',
                'status'     => 'active',
                'mode'       => 'discovery',
                'pattern'    => '/jobs/p/',
                'headers'    => null,
                'params'     => null,
            ],
        ];

        foreach ($sources as $source) {
            \App\Models\ScrapingSource::updateOrCreate(
                ['name' => $source['name']],
                $source
            );
        }

        $this->command->info('✓ Seeded ' . count($sources) . ' global scraping source templates (with {query} placeholders).');
    }
}
