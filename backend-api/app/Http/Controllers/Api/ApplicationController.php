<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\Application;
use Illuminate\Http\JsonResponse;

class ApplicationController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        $applications = auth()->user()->applications()->with('job')->latest()->get();

        return response()->json([
            'success' => true,
            'data' => $applications,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'job_id' => 'required|exists:job_postings,id',
            'status' => 'nullable|in:saved,applied,interviewing,offered,rejected,archived',
            'notes' => 'nullable|string',
        ]);

        $application = auth()->user()->applications()->updateOrCreate(
            ['job_id' => $request->job_id],
            [
                'status' => $request->status ?? 'saved',
                'notes' => $request->notes,
                'applied_at' => $request->status === 'applied' ? now() : null,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'Job saved to your tracker',
            'data' => $application,
        ]);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id): JsonResponse
    {
        $application = auth()->user()->applications()->with('job')->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $application,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $application = auth()->user()->applications()->findOrFail($id);

        $request->validate([
            'status' => 'nullable|in:saved,applied,interviewing,offered,rejected,archived',
            'notes' => 'nullable|string',
        ]);

        $application->update($request->only(['status', 'notes']));

        if ($request->status === 'applied' && !$application->applied_at) {
            $application->update(['applied_at' => now()]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Application updated',
            'data' => $application,
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id): JsonResponse
    {
        $application = auth()->user()->applications()->findOrFail($id);
        $application->delete();

        return response()->json([
            'success' => true,
            'message' => 'Application removed from tracker',
        ]);
    }
}
