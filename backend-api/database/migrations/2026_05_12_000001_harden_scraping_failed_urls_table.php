<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->makeSourceNullableForMysql();

        Schema::table('scraping_failed_urls', function (Blueprint $table) {
            if (!Schema::hasColumn('scraping_failed_urls', 'scraping_job_id')) {
                $table->foreignId('scraping_job_id')
                    ->nullable()
                    ->after('id')
                    ->constrained('scraping_jobs')
                    ->nullOnDelete();
            }
        });

        Schema::table('scraping_failed_urls', function (Blueprint $table) {
            $table->index(['scraping_job_id', 'retried'], 'failed_urls_job_retried_idx');
        });
    }

    public function down(): void
    {
        Schema::table('scraping_failed_urls', function (Blueprint $table) {
            $table->dropIndex('failed_urls_job_retried_idx');
            $table->dropConstrainedForeignId('scraping_job_id');
        });

        $this->makeSourceRequiredForMysql();
    }

    private function makeSourceNullableForMysql(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement('ALTER TABLE scraping_failed_urls DROP FOREIGN KEY scraping_failed_urls_scraping_source_id_foreign');
        DB::statement('ALTER TABLE scraping_failed_urls MODIFY scraping_source_id BIGINT UNSIGNED NULL');
        DB::statement(
            'ALTER TABLE scraping_failed_urls ADD CONSTRAINT scraping_failed_urls_scraping_source_id_foreign FOREIGN KEY (scraping_source_id) REFERENCES scraping_sources(id) ON DELETE SET NULL'
        );
    }

    private function makeSourceRequiredForMysql(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        DB::statement('ALTER TABLE scraping_failed_urls DROP FOREIGN KEY scraping_failed_urls_scraping_source_id_foreign');
        DB::statement('ALTER TABLE scraping_failed_urls MODIFY scraping_source_id BIGINT UNSIGNED NOT NULL');
        DB::statement(
            'ALTER TABLE scraping_failed_urls ADD CONSTRAINT scraping_failed_urls_scraping_source_id_foreign FOREIGN KEY (scraping_source_id) REFERENCES scraping_sources(id) ON DELETE CASCADE'
        );
    }
};
