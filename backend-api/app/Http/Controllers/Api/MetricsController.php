<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Job;
use App\Models\ScrapingFailedUrl;
use App\Models\ScrapingJob;
use App\Models\ScrapingSource;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class MetricsController extends Controller
{
    public function prometheus(): Response
    {
        $lines = [
            '# HELP career_compass_jobs_total Total job postings.',
            '# TYPE career_compass_jobs_total gauge',
            'career_compass_jobs_total ' . Job::count(),
            '# HELP career_compass_scraping_sources_total Scraping sources by status.',
            '# TYPE career_compass_scraping_sources_total gauge',
        ];

        foreach (ScrapingSource::query()->select('status', DB::raw('count(*) as total'))->groupBy('status')->get() as $row) {
            $lines[] = sprintf('career_compass_scraping_sources_total{status="%s"} %d', $this->label($row->status), $row->total);
        }

        $lines[] = '# HELP career_compass_scraping_jobs_total Scraping jobs by status.';
        $lines[] = '# TYPE career_compass_scraping_jobs_total gauge';
        foreach (ScrapingJob::query()->select('status', DB::raw('count(*) as total'))->groupBy('status')->get() as $row) {
            $lines[] = sprintf('career_compass_scraping_jobs_total{status="%s"} %d', $this->label($row->status), $row->total);
        }

        $lines[] = '# HELP career_compass_queue_jobs_total Pending queue jobs by queue.';
        $lines[] = '# TYPE career_compass_queue_jobs_total gauge';
        foreach (DB::table('jobs')->select('queue', DB::raw('count(*) as total'))->groupBy('queue')->get() as $row) {
            $lines[] = sprintf('career_compass_queue_jobs_total{queue="%s"} %d', $this->label($row->queue), $row->total);
        }

        $lines[] = '# HELP career_compass_failed_jobs_total Failed queue jobs.';
        $lines[] = '# TYPE career_compass_failed_jobs_total gauge';
        $lines[] = 'career_compass_failed_jobs_total ' . DB::table('failed_jobs')->count();

        $lines[] = '# HELP career_compass_scraping_failed_urls_total Failed scraped URLs by retried state.';
        $lines[] = '# TYPE career_compass_scraping_failed_urls_total gauge';
        foreach (ScrapingFailedUrl::query()->select('retried', DB::raw('count(*) as total'))->groupBy('retried')->get() as $row) {
            $lines[] = sprintf('career_compass_scraping_failed_urls_total{retried="%s"} %d', $row->retried ? 'true' : 'false', $row->total);
        }

        $lines[] = '# HELP career_compass_app_info Application info.';
        $lines[] = '# TYPE career_compass_app_info gauge';
        $lines[] = sprintf(
            'career_compass_app_info{env="%s",version="%s"} 1',
            $this->label(app()->environment()),
            $this->label((string) config('app.version', '1.0.0'))
        );

        return response(implode("\n", $lines) . "\n", 200)
            ->header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    }

    private function label(string $value): string
    {
        return str_replace(['\\', '"', "\n"], ['\\\\', '\"', ''], $value);
    }
}
