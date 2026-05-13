<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\StoreApplicationRequest;
use App\Http\Requests\UpdateApplicationRequest;
use App\Http\Controllers\Controller;
use App\Http\Resources\ApplicationResource;

use Illuminate\Http\JsonResponse;
use App\Services\ApplicationTrackerService;

class ApplicationController extends Controller
{
    public function __construct(private readonly ApplicationTrackerService $trackerService)
    {
    }

    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        $applications = $this->trackerService->listForUser(auth()->user());

        return response()->json([
            'success' => true,
            'data' => ApplicationResource::collection($applications),
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreApplicationRequest $request): JsonResponse
    {
        $application = $this->trackerService->createOrUpdate(auth()->user(), $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'Job saved to your tracker',
            'data' => new ApplicationResource($application),
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
            'data' => new ApplicationResource($application),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateApplicationRequest $request, string $id): JsonResponse
    {
        $application = auth()->user()->applications()->findOrFail($id);
        $application = $this->trackerService->update($application, $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'Application updated',
            'data' => new ApplicationResource($application),
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
