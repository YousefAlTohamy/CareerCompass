<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Expand the 'type' ENUM column in scraping_sources to include 'spa'.
     * Uses raw SQL because doctrine/dbal is not installed for ->change() support.
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE scraping_sources MODIFY COLUMN type ENUM('api', 'html', 'json', 'spa') DEFAULT 'api'");
    }

    /**
     * Revert to the original ENUM values (without 'spa').
     */
    public function down(): void
    {
        DB::statement("ALTER TABLE scraping_sources MODIFY COLUMN type ENUM('api', 'html', 'json') DEFAULT 'api'");
    }
};
