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
            'endpoint' => [
                'sometimes',
                'string',
                'max:512',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    $endpoint = (string) $value;

                    if (str_starts_with($endpoint, 'demo://')) {
                        return;
                    }

                    if (filter_var($endpoint, FILTER_VALIDATE_URL) === false) {
                        $fail('The endpoint must be a valid URL or a demo:// source endpoint.');
                    }
                },
            ],
            'method' => ['sometimes', 'in:GET,POST'],
            'type' => ['sometimes', 'in:api,html,json,spa,demo,local'],
            'mode' => ['sometimes', 'in:static,discovery'],
            'pattern' => ['sometimes', 'nullable', 'string', 'max:512'],
            'status' => ['sometimes', 'in:active,inactive'],
            'is_active' => ['sometimes', 'boolean'],
            'headers' => ['sometimes', 'nullable', 'array'],
            'params' => ['sometimes', 'nullable', 'array'],
        ];
    }
}
