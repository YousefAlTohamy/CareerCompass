<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class AdminUserController extends Controller
{
    /**
     * Display a listing of users with search and pagination.
     * Excludes 'admin' role.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        try {
            // Exclude admin role and eager load skills
            $query = User::with('skills')->where(function ($q) {
                $q->whereNull('role')->orWhere('role', '!=', 'admin');
            });

            // Handle search
            if ($request->filled('search')) {
                $search = $request->input('search');
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            }

            // Paginate results, order by created_at desc
            $users = $query->orderBy('created_at', 'desc')->paginate(10);

            return response()->json([
                'success' => true,
                'data' => $users
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch users',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified user with eager loaded skills.
     *
     * @param int $id
     * @return JsonResponse
     */
    public function show($id): JsonResponse
    {
        try {
            // Include skills relation if it exists, otherwise just findOrFail
            $user = User::with('skills')->findOrFail($id);
            return response()->json([
                'success' => true,
                'data' => $user
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'User not found'
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch user details',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Toggle the ban status of the specified user.
     *
     * @param int $id
     * @return JsonResponse
     */
    public function toggleBan($id): JsonResponse
    {
        try {
            $user = User::findOrFail($id);

            // Prevent banning other admins
            if ($user->role === 'admin') {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot ban an admin user.'
                ], 403);
            }

            $user->is_banned = !$user->is_banned;
            $user->save();

            // Note: If you want to revoke their tokens immediately upon ban:
            if ($user->is_banned) {
                $user->tokens()->delete();
            }

            $status = $user->is_banned ? 'banned' : 'unbanned';

            return response()->json([
                'success' => true,
                'message' => "User successfully {$status}.",
                'data' => [
                    'is_banned' => $user->is_banned
                ]
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'User not found'
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to toggle user ban status',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
