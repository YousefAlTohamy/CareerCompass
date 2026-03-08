<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Register a new user with strict validation.
     */
    public function register(Request $request): JsonResponse
    {
        $request->validate(
            [
                'name'     => 'required|string|max:255',
                'email'    => [
                    'required',
                    'string',
                    'email:rfc,dns',
                    'max:255',
                    'unique:users',
                    'regex:/^[a-zA-Z0-9._%+\-]+@(gmail\.com|yahoo\.com|outlook\.com|hotmail\.com|icloud\.com)$/i',
                ],
                'password' => [
                    'required',
                    'string',
                    'min:8',
                    'regex:/^(?=.*[A-Z])(?=.*\d)[A-Za-z\d@&_\-]+$/',
                ],
            ],
            [
                'email.regex'    => 'Only Gmail, Yahoo, Outlook, Hotmail, or iCloud email addresses are accepted.',
                'password.regex' => 'Password must be at least 8 characters and contain at least one uppercase letter and one number. Only these special characters are allowed: @ & _ -',
            ]
        );

        $user = User::create([
            'name'     => $request->name,
            'email'    => $request->email,
            'password' => Hash::make($request->password),
            'role'     => 'user',
        ]);

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'User registered successfully',
            'data'    => [
                'user'  => [
                    'id'    => $user->id,
                    'name'  => $user->name,
                    'email' => $user->email,
                    'role'  => $user->role,
                ],
                'token' => $token,
            ],
        ], 201);
    }

    /**
     * Update the authenticated user's profile.
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name'         => 'required|string|max:255',
            'email'        => [
                'required',
                'string',
                'email',
                'max:255',
                'unique:users,email,' . $user->id,
            ],
            'phone'        => 'nullable|string|max:255',
            'job_title'    => 'nullable|string|max:255',
            'location'     => 'nullable|string|max:255',
            'linkedin_url' => 'nullable|url|max:255',
            'github_url'   => 'nullable|url|max:255',
        ]);

        $user->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully',
            'data'    => $user,
        ]);
    }

    /**
     * Login a user.
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        // Revoke old tokens
        $user->tokens()->delete();

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login successful',
            'data'    => [
                'user'  => [
                    'id'    => $user->id,
                    'name'  => $user->name,
                    'email' => $user->email,
                    'role'  => $user->role,
                ],
                'token' => $token,
            ],
        ]);
    }

    /**
     * Logout the user (revoke all tokens).
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->tokens()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully',
        ]);
    }
}
