<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add match_score, seniority, primary_domain, and summary columns to cv_analyses.
     * These are populated from the Python /api/v3/match-job response.
     */
    public function up(): void
    {
        Schema::table('cv_analyses', function (Blueprint $table) {
            $table->decimal('match_score', 5, 2)->nullable()->after('completeness_score');
            $table->string('seniority')->nullable()->after('match_score');
            $table->string('primary_domain')->nullable()->after('seniority');
            $table->text('summary')->nullable()->after('primary_domain');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cv_analyses', function (Blueprint $table) {
            $table->dropColumn(['match_score', 'seniority', 'primary_domain', 'summary']);
        });
    }
};
