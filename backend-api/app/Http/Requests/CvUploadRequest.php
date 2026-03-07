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
            'cv.required' => 'Please upload a CV file.',
            'cv.file'     => 'The uploaded file is invalid.',
            'cv.mimes'    => 'The CV must be a PDF, JPEG, JPG, or PNG file.',
            'cv.max'      => 'The CV file size must not exceed 5MB.',
        ];
    }
}
