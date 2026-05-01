<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreScrapedJobRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        // For the Python scraper, authorize should be true as Sanctum handles the authentication
        return true;
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
            'description' => 'required|string',
            'company' => 'required|string|max:255',
            'url' => 'required|url',
            'scraping_source_id' => 'required|exists:scraping_sources,id',
            'location' => 'nullable|string|max:255',
            'salary_range' => 'nullable|string|max:255',
            'job_type' => 'nullable|string|max:255',
            'experience' => 'nullable|string|max:255',
            'requirements' => 'nullable|string',
            'skills' => 'nullable|array',
            'skills.*' => 'string',
            'work_type' => 'nullable|string|max:255',
            'source' => 'nullable|string|max:255',
        ];
    }
}
