<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\TargetJobRole;
use App\Jobs\ProcessMarketScraping;
use Illuminate\Http\Request;

class TargetJobRoleController extends Controller
{
    public function index(Request $request)
    {
        $query = TargetJobRole::query();

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where('name', 'like', "%{$search}%");
        }

        $roles = $query->orderBy('created_at', 'desc')->paginate(10);
        return response()->json($roles);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|unique:target_job_roles,name',
            'is_active' => 'boolean',
        ]);

        $role = TargetJobRole::create([
            'name' => $request->name,
            'is_active' => $request->is_active ?? true,
        ]);

        return response()->json(['message' => 'Role added successfully', 'data' => $role], 201);
    }

    public function toggleActive($id)
    {
        $role = TargetJobRole::findOrFail($id);
        $role->is_active = !$role->is_active;
        $role->save();

        return response()->json(['message' => 'Role status updated successfully', 'data' => $role]);
    }

    public function destroy($id)
    {
        $role = TargetJobRole::findOrFail($id);
        $role->delete();

        return response()->json(['message' => 'Role deleted successfully']);
    }

    public function runFullScraping()
    {
        ProcessMarketScraping::dispatch(null, 30);
        return response()->json(['message' => 'Full scraping background job has been dispatched.']);
    }
}
