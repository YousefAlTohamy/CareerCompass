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
        Schema::create('cv_analyses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('parsing_status')->default('pending');
            $table->string('seniority')->nullable();
            $table->string('predicted_role')->nullable();
            $table->string('primary_domain')->nullable();
            $table->float('confidence_score')->nullable();
            $table->text('summary')->nullable();
            $table->integer('completeness_score')->nullable();
            $table->json('strengths')->nullable();
            $table->json('gaps')->nullable();
            $table->json('red_flags')->nullable();
            $table->json('metadata')->nullable();
            $table->json('raw_json_output')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'parsing_status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cv_analyses');
    }
};
