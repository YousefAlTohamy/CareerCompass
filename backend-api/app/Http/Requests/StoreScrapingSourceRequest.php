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
            'endpoint' => ['required', 'url', 'max:512'],
            'type'     => ['required', 'in:api,html,spa'],
            'mode'     => ['sometimes', 'in:static,discovery'],
            'pattern'  => ['sometimes', 'nullable', 'string', 'max:512'],
            'status'   => ['sometimes', 'in:active,inactive'],
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
            'endpoint.url'  => 'The endpoint must be a valid URL (including http:// or https://).',
            'type.in'       => 'Source type must be either "api", "html", or "spa".',
            'mode.in'       => 'Mode must be either "static" or "discovery".',
            'status.in'     => 'Status must be either "active" or "inactive".',
        ];
    }
}
