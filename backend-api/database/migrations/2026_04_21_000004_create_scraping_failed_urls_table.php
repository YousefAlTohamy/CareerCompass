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
            $table->foreignId('scraping_source_id')->constrained('scraping_sources')->cascadeOnDelete();
            $table->text('url');
            $table->text('error_message')->nullable();
            $table->boolean('retried')->default(false);
            $table->timestamp('failed_at')->useCurrent();
            $table->timestamps();

            $table->index('scraping_source_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scraping_failed_urls');
    }
};
