<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class BatchGapAnalysisRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'job_ids' => ['required', 'array', 'min:1', 'max:20'],
            'job_ids.*' => ['required', 'integer', 'exists:job_postings,id'],
        ];
    }
}
