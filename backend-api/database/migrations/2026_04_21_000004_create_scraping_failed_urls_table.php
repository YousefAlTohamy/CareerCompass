<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Create the scraping_failed_urls table (Dead Letter Queue).
     * Records each URL that failed during a scraping run with the reason.
     */
    public function up(): void
    {
        Schema::create('scraping_failed_urls', function (Blueprint $table) {
            $table->id();
            $table->foreignId('scraping_job_id')->constrained('scraping_jobs')->cascadeOnDelete();
            $table->text('url');
            $table->string('reason', 255)->default('unknown');
            $table->string('source_name', 255)->nullable();
            $table->boolean('retried')->default(false);
            $table->timestamps();

            $table->index('scraping_job_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scraping_failed_urls');
    }
};
