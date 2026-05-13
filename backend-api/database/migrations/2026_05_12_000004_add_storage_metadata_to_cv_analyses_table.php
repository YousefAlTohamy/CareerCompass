<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cv_analyses', function (Blueprint $table): void {
            if (!Schema::hasColumn('cv_analyses', 'cv_disk')) {
                $table->string('cv_disk', 64)->nullable()->after('user_id');
            }

            if (!Schema::hasColumn('cv_analyses', 'cv_path')) {
                $table->string('cv_path', 1024)->nullable()->after('cv_disk');
            }

            if (!Schema::hasColumn('cv_analyses', 'cv_original_name')) {
                $table->string('cv_original_name')->nullable()->after('cv_path');
            }

            if (!Schema::hasColumn('cv_analyses', 'cv_mime')) {
                $table->string('cv_mime', 127)->nullable()->after('cv_original_name');
            }

            if (!Schema::hasColumn('cv_analyses', 'cv_size')) {
                $table->unsignedBigInteger('cv_size')->nullable()->after('cv_mime');
            }

            if (!Schema::hasColumn('cv_analyses', 'cv_sha256')) {
                $table->char('cv_sha256', 64)->nullable()->after('cv_size');
                $table->index('cv_sha256', 'cv_analyses_cv_sha256_index');
            }

            if (!Schema::hasColumn('cv_analyses', 'cv_uploaded_at')) {
                $table->timestamp('cv_uploaded_at')->nullable()->after('cv_sha256');
                $table->index('cv_uploaded_at', 'cv_analyses_cv_uploaded_at_index');
            }
        });
    }

    public function down(): void
    {
        Schema::table('cv_analyses', function (Blueprint $table): void {
            if (Schema::hasColumn('cv_analyses', 'cv_sha256')) {
                $table->dropIndex('cv_analyses_cv_sha256_index');
            }

            if (Schema::hasColumn('cv_analyses', 'cv_uploaded_at')) {
                $table->dropIndex('cv_analyses_cv_uploaded_at_index');
            }

            $columns = [
                'cv_uploaded_at',
                'cv_sha256',
                'cv_size',
                'cv_mime',
                'cv_original_name',
                'cv_path',
                'cv_disk',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('cv_analyses', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
