<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\TargetJobRoleResource;
use App\Models\TargetJobRole;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TargetRoleController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return TargetJobRoleResource::collection(
            TargetJobRole::query()
                ->where('is_active', true)
                ->orderBy('name')
                ->get()
        );
    }
}
