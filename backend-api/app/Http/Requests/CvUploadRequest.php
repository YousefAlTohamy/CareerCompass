<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CvUploadRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        // User must be authenticated (handled by auth middleware)
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
            'cv' => [
                'required',
                'file',
                'mimes:pdf,jpeg,jpg,png',  // PDF + image formats (OCR via AI Gateway)
                'max:5120',                 // 5 MB in kilobytes
            ],
            'job_title' => [
                'nullable',
                'string',
                'max:255',
            ],
            'job_description' => [
                'nullable',
                'string',
                'max:5000',
            ],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'cv.required'             => 'Please upload a CV file.',
            'cv.file'                 => 'The uploaded file is invalid.',
            'cv.mimes'                => 'The CV must be a PDF, JPEG, JPG, or PNG file.',
            'cv.max'                  => 'The CV file size must not exceed 5MB.',
            'job_title.max'           => 'The job title must not exceed 255 characters.',
            'job_description.max'     => 'The job description must not exceed 5000 characters.',
        ];
    }
}
