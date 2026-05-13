<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ScrapeJobsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'query' => ['required', 'string', 'max:255'],
            'max_results' => ['nullable', 'integer', 'min:1', 'max:50'],
            'use_samples' => ['nullable', 'boolean'],
        ];
    }
}
