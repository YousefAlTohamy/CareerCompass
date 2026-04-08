<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Phase 5 Integration: Add advanced analytics columns to cv_analyses
     * and technologies to user_experiences.
     *
     * Safe for existing data — all new columns are nullable.
     */
    public function up(): void
    {
        // ── cv_analyses: Phase 4 analytics columns ───────────────────────
        Schema::table('cv_analyses', function (Blueprint $table) {
            $table->string('seniority')->nullable()->after('parsing_status');
            $table->string('predicted_role')->nullable()->after('seniority');
            $table->string('primary_domain')->nullable()->after('predicted_role');
            $table->float('confidence_score')->nullable()->after('primary_domain');
            $table->text('summary')->nullable()->after('confidence_score');
            $table->json('metadata')->nullable()->after('red_flags');
        });

        // ── user_experiences: Phase 2 technologies per job ───────────────
        Schema::table('user_experiences', function (Blueprint $table) {
            $table->json('technologies')->nullable()->after('description');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cv_analyses', function (Blueprint $table) {
            $table->dropColumn([
                'seniority',
                'predicted_role',
                'primary_domain',
                'confidence_score',
                'summary',
                'metadata',
            ]);
        });

        Schema::table('user_experiences', function (Blueprint $table) {
            $table->dropColumn('technologies');
        });
    }
};
