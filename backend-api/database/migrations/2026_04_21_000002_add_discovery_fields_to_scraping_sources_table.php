<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('scraping_sources', function (Blueprint $table) {
            // Discovery mode determines how the backend (and AI engine) should treat this source.
            // Default keeps existing records compatible.
            $table->enum('mode', ['static', 'discovery'])->default('static')->after('type');

            // Regex (or heuristic pattern string) used by the AI discovery engine to extract job links.
            $table->string('pattern')->nullable()->after('mode');
        });
    }

    public function down(): void
    {
        Schema::table('scraping_sources', function (Blueprint $table) {
            $table->dropColumn(['mode', 'pattern']);
        });
    }
};

