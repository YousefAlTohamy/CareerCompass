<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreApplicationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'job_id' => ['required', 'integer', 'exists:job_postings,id'],
            'status' => ['nullable', 'in:saved,applied,interviewing,offered,rejected,archived'],
            'notes' => ['nullable', 'string', 'max:10000'],
        ];
    }
}
