<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ScrapingProxy;
use Illuminate\Http\JsonResponse;

class InternalProxyController extends Controller
{
    public function active(): JsonResponse
    {
        $proxies = ScrapingProxy::where('is_active', true)
            ->get(['protocol', 'host', 'port', 'username', 'password']);

        return response()->json([
            'success' => true,
            'data' => $proxies,
        ]);
    }
}
