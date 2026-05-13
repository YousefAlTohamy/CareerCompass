<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Requests\UpdateProfileRequest;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\SkillSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private readonly SkillSyncService $skillSyncService)
    {
    }

    /**
     * Register a new user with strict validation.
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $user = User::create([
            'name'     => $request->name,
            'email'    => $request->email,
            'password' => Hash::make($request->password),
            'role'     => 'user',
        ]);

        // Profile is auto-created via User model's booted() created event
        $token = $user->createToken('auth-token')->plainTextToken;
        $user->load(['profile', 'experiences', 'skills', 'cvAnalysis']);

        return response()->json([
            'success' => true,
            'message' => 'User registered successfully',
            'data'    => [
                'user'  => new UserResource($user),
                'token' => $token,
            ],
        ], 201);
    }

    /**
     * Update the authenticated user's profile.
     */
    public function updateProfile(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validated();

        // Update user auth fields
        $user->update([
            'name'  => $validated['name'],
            'email' => $validated['email'],
        ]);

        // Update profile (create if missing)
        $profile = $user->profile()->firstOrCreate(
            ['user_id' => $user->id],
            []
        );
        $contactInfo = $profile->contact_info ?? [];
        if (isset($validated['phone'])) {
            $contactInfo['phone'] = $validated['phone'];
        }
        if (isset($validated['linkedin_url'])) {
            $contactInfo['linkedin_url'] = $validated['linkedin_url'];
        }
        if (isset($validated['github_url'])) {
            $contactInfo['github_url'] = $validated['github_url'];
        }
        $profile->update([
            'headline'     => $validated['job_title'] ?? $profile->headline,
            'location'     => $validated['location'] ?? $profile->location,
            'contact_info' => $contactInfo,
        ]);

        if ($request->has('skills')) {
            $this->skillSyncService->syncUserSkills($user, $validated['skills'] ?? [], true);
        }

        $user->load(['profile', 'experiences', 'skills', 'cvAnalysis']);

        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully',
            'data'    => new UserResource($user),
        ]);
    }

    /**
     * Login a user.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if ($user->is_banned) {
            return response()->json([
                'success' => false,
                'message' => 'Your account has been banned. Please contact support.',
            ], 403);
        }

        // Revoke old tokens
        $user->tokens()->delete();

        $token = $user->createToken('auth-token')->plainTextToken;
        $user->load(['profile', 'experiences', 'skills', 'cvAnalysis']);

        return response()->json([
            'success' => true,
            'message' => 'Login successful',
            'data'    => [
                'user'  => new UserResource($user),
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

    public function user(Request $request): UserResource
    {
        $user = $request->user()->load(['profile', 'experiences', 'skills', 'cvAnalysis']);

        return new UserResource($user);
    }
}
