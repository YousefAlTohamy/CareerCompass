<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return;
        }

        DB::statement(
            "ALTER TABLE scraping_sources MODIFY type ENUM('api', 'html', 'json', 'spa', 'demo', 'local') NOT NULL DEFAULT 'api'"
        );
    }

    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'mysql') {
            return;
        }

        DB::statement(
            "ALTER TABLE scraping_sources MODIFY type ENUM('api', 'html', 'json', 'spa') NOT NULL DEFAULT 'api'"
        );
    }
};
