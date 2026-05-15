<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreScrapingSourceRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     * For now, any authenticated user can manage sources (extend for role-check later).
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name'     => ['required', 'string', 'max:255'],
            'endpoint' => [
                'required',
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
            'method'   => ['sometimes', 'in:GET,POST'],
            'type'     => ['required', 'in:api,html,json,spa,demo,local'],
            'mode'     => ['sometimes', 'in:static,discovery'],
            'pattern'  => ['sometimes', 'nullable', 'string', 'max:512'],
            'status'   => ['sometimes', 'in:active,inactive'],
            'is_active' => ['sometimes', 'boolean'],
            'headers'  => ['sometimes', 'nullable', 'array'],
            'params'   => ['sometimes', 'nullable', 'array'],
        ];
    }

    /**
     * Human-readable validation error messages.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'type.in'       => 'Source type must be one of "api", "html", "json", "spa", "demo", or "local".',
            'mode.in'       => 'Mode must be either "static" or "discovery".',
            'status.in'     => 'Status must be either "active" or "inactive".',
        ];
    }
}
