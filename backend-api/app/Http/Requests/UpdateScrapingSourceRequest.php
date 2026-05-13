<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateScrapingSourceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'endpoint' => ['sometimes', 'url', 'max:512'],
            'method' => ['sometimes', 'in:GET,POST'],
            'type' => ['sometimes', 'in:api,html,json,spa'],
            'mode' => ['sometimes', 'in:static,discovery'],
            'pattern' => ['sometimes', 'nullable', 'string', 'max:512'],
            'status' => ['sometimes', 'in:active,inactive'],
            'is_active' => ['sometimes', 'boolean'],
            'headers' => ['sometimes', 'nullable', 'array'],
            'params' => ['sometimes', 'nullable', 'array'],
        ];
    }
}
