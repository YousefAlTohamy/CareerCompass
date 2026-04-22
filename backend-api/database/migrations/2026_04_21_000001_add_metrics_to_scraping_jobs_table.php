<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('scraping_jobs', function (Blueprint $table) {
            $table->unsignedInteger('discovered_count')->default(0)->after('jobs_duplicated');
            $table->unsignedInteger('failed_count')->default(0)->after('discovered_count');
            $table->unsignedInteger('processing_time_ms')->default(0)->after('failed_count');
        });
    }

    public function down(): void
    {
        Schema::table('scraping_jobs', function (Blueprint $table) {
            $table->dropColumn(['discovered_count', 'failed_count', 'processing_time_ms']);
        });
    }
};

