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
        Schema::create('scraping_proxies', function (Blueprint $table) {
            $table->id();
            $table->string('host');
            $table->string('port');
            $table->string('username')->nullable();
            $table->string('password')->nullable();
            $table->string('protocol')->default('http');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('scraping_proxies');
    }
};
