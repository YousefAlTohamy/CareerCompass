<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreScrapedJobRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     * Sanctum middleware handles authentication at the route level.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Sanitize input data before validation to prevent XSS
     * from untrusted scraped content.
     */
    protected function prepareForValidation(): void
    {
        $fieldsToSanitize = ['description', 'requirements', 'title', 'company', 'location'];

        $sanitized = [];
        foreach ($fieldsToSanitize as $field) {
            if ($this->has($field) && is_string($this->input($field))) {
                // Strip any remaining HTML/script tags that survived the Python pipeline
                $sanitized[$field] = strip_tags($this->input($field));
            }
        }

        if (!empty($sanitized)) {
            $this->merge($sanitized);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'title' => 'required|string|max:255',
            'description' => 'required|string|max:65535',
            'company' => 'required|string|max:255',
            'url' => 'required|url|max:2048',
            'scraping_source_id' => 'required|integer|exists:scraping_sources,id',
            'location' => 'nullable|string|max:255',
            'salary_range' => 'nullable|string|max:255',
            'job_type' => 'nullable|string|in:full-time,part-time,contract,internship,freelance,temporary',
            'experience' => 'nullable|string|max:255',
            'requirements' => 'nullable|string|max:65535',
            'skills' => 'nullable|array|max:50',
            'skills.*' => 'string|max:100',
            'work_type' => 'nullable|string|in:remote,hybrid,onsite,on-site',
            'source' => 'nullable|string|max:255',
        ];
    }
}
