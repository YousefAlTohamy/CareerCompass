<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('job_postings', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('description');
            $table->string('company');
            $table->string('location')->nullable();
            $table->string('salary_range')->nullable();
            $table->string('job_type')->nullable();
            $table->string('experience')->nullable();
            $table->text('requirements')->nullable();
            $table->json('skills')->nullable();
            $table->string('work_type')->nullable(); // Onsite, Remote, Hybrid
            $table->string('url')->nullable();
            $table->string('source')->nullable()->comment('e.g., Wuzzuf, LinkedIn');
            $table->foreignId('scraping_source_id')
                ->nullable()
                ->constrained('scraping_sources')
                ->nullOnDelete();
            $table->timestamps();

            // Unique constraints to prevent duplicate job postings
            $table->unique('url', 'jobs_url_unique');
            $table->unique(['title', 'company'], 'jobs_title_company_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('job_postings');
    }
};
