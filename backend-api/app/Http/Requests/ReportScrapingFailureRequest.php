<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ReportScrapingFailureRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'url' => ['required', 'url', 'max:2048'],
            'scraping_source_id' => ['nullable', 'integer', 'exists:scraping_sources,id'],
            'scraping_job_id' => ['nullable', 'integer', 'exists:scraping_jobs,id'],
            'error_message' => ['nullable', 'string', 'max:10000'],
            'failed_at' => ['nullable', 'date'],
        ];
    }
}
