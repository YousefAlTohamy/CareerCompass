<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'string',
                'email:rfc',
                'max:255',
                'unique:users,email',
                'regex:/^[a-zA-Z0-9._%+\-]+@(gmail\.com|yahoo\.com|outlook\.com|hotmail\.com|icloud\.com)$/i',
            ],
            'password' => [
                'required',
                'string',
                'min:8',
                'regex:/^(?=.*[A-Z])(?=.*\d)[A-Za-z\d@&_\-]+$/',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'email.regex' => 'Only Gmail, Yahoo, Outlook, Hotmail, or iCloud email addresses are accepted.',
            'password.regex' => 'Password must be at least 8 characters and contain at least one uppercase letter and one number. Only these special characters are allowed: @ & _ -',
        ];
    }
}
