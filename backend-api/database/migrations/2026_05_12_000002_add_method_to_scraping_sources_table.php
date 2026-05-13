<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('scraping_sources', function (Blueprint $table) {
            if (!Schema::hasColumn('scraping_sources', 'method')) {
                $table->string('method', 8)->default('GET')->after('endpoint');
            }
        });
    }

    public function down(): void
    {
        Schema::table('scraping_sources', function (Blueprint $table) {
            if (Schema::hasColumn('scraping_sources', 'method')) {
                $table->dropColumn('method');
            }
        });
    }
};
