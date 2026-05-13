<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->deduplicateApplications();
        $this->deduplicateCvAnalyses();

        Schema::table('applications', function (Blueprint $table) {
            $table->unique(['user_id', 'job_id'], 'applications_user_job_unique');
            $table->index(['user_id', 'status'], 'applications_user_status_idx');
        });

        Schema::table('cv_analyses', function (Blueprint $table) {
            $table->unique('user_id', 'cv_analyses_user_unique');
        });

        Schema::table('job_postings', function (Blueprint $table) {
            $table->index(['source', 'created_at'], 'job_postings_source_created_idx');
            $table->index(['scraping_source_id', 'created_at'], 'job_postings_scraping_source_created_idx');
            $table->index('created_at', 'job_postings_created_idx');
        });

        Schema::table('job_skills', function (Blueprint $table) {
            $table->index(['skill_id', 'job_id'], 'job_skills_skill_job_idx');
        });
    }

    public function down(): void
    {
        Schema::table('job_skills', function (Blueprint $table) {
            $table->dropIndex('job_skills_skill_job_idx');
        });

        Schema::table('job_postings', function (Blueprint $table) {
            $table->dropIndex('job_postings_source_created_idx');
            $table->dropIndex('job_postings_scraping_source_created_idx');
            $table->dropIndex('job_postings_created_idx');
        });

        Schema::table('cv_analyses', function (Blueprint $table) {
            $table->dropUnique('cv_analyses_user_unique');
        });

        Schema::table('applications', function (Blueprint $table) {
            $table->dropIndex('applications_user_status_idx');
            $table->dropUnique('applications_user_job_unique');
        });
    }

    private function deduplicateApplications(): void
    {
        DB::table('applications')
            ->select('user_id', 'job_id', DB::raw('MIN(id) as keep_id'), DB::raw('COUNT(*) as duplicate_count'))
            ->groupBy('user_id', 'job_id')
            ->havingRaw('COUNT(*) > 1')
            ->orderBy('keep_id')
            ->lazy()
            ->each(function ($row): void {
                DB::table('applications')
                    ->where('user_id', $row->user_id)
                    ->where('job_id', $row->job_id)
                    ->where('id', '!=', $row->keep_id)
                    ->delete();
            });
    }

    private function deduplicateCvAnalyses(): void
    {
        DB::table('cv_analyses')
            ->select('user_id', DB::raw('MAX(id) as keep_id'), DB::raw('COUNT(*) as duplicate_count'))
            ->groupBy('user_id')
            ->havingRaw('COUNT(*) > 1')
            ->orderBy('keep_id')
            ->lazy()
            ->each(function ($row): void {
                DB::table('cv_analyses')
                    ->where('user_id', $row->user_id)
                    ->where('id', '!=', $row->keep_id)
                    ->delete();
            });
    }
};
