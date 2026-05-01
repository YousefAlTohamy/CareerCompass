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
        Schema::create('job_skills', function (Blueprint $table) {
            $table->id();
            $table->foreignId('job_id')->constrained('job_postings')->onDelete('cascade');
            $table->foreignId('skill_id')->constrained()->onDelete('cascade');
            $table->boolean('required')->default(true);

            // Importance score (0-100 percentage)
            $table->decimal('importance_score', 5, 2)->nullable();

            // Importance category based on frequency
            $table->enum('importance_category', ['essential', 'important', 'nice_to_have'])
                ->nullable()
                ->comment('essential: >70%, important: 40-70%, nice_to_have: <40%');

            $table->timestamps();

            // Ensure unique combination of job and skill
            $table->unique(['job_id', 'skill_id']);

            // Indexes for faster queries
            $table->index('importance_category');
            $table->index('importance_score');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('job_skills');
    }
};
