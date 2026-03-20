<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Creates user_profiles table and migrates legacy profile data from users.
     * Consolidates: job_title, phone, location, linkedin_url, github_url into user_profiles.
     */
    public function up(): void
    {
        Schema::create('user_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('headline')->nullable()->comment('Replaces old job_title');
            $table->text('summary')->nullable();
            $table->string('location')->nullable();
            $table->decimal('total_experience_years', 8, 2)->nullable();
            $table->string('seniority')->nullable();
            $table->string('primary_domain')->nullable();
            $table->json('contact_info')->nullable()->comment('phone, linkedin_url, github_url, etc.');
            $table->timestamps();

            $table->unique('user_id');
        });

        // Migrate existing data from users table (if legacy columns exist)
        $hasLegacyColumns = Schema::hasColumn('users', 'job_title') || Schema::hasColumn('users', 'phone');
        $users = DB::table('users')->get();

        foreach ($users as $user) {
            $headline = null;
            $location = null;
            $contactInfo = [];

            if ($hasLegacyColumns) {
                $headline = Schema::hasColumn('users', 'job_title') ? ($user->job_title ?? null) : null;
                $location = Schema::hasColumn('users', 'location') ? ($user->location ?? null) : null;
                if (Schema::hasColumn('users', 'phone') && !empty($user->phone ?? null)) {
                    $contactInfo['phone'] = $user->phone;
                }
                if (Schema::hasColumn('users', 'linkedin_url') && !empty($user->linkedin_url ?? null)) {
                    $contactInfo['linkedin_url'] = $user->linkedin_url;
                }
                if (Schema::hasColumn('users', 'github_url') && !empty($user->github_url ?? null)) {
                    $contactInfo['github_url'] = $user->github_url;
                }
            }

            DB::table('user_profiles')->insert([
                'user_id'     => $user->id,
                'headline'    => $headline,
                'location'    => $location,
                'contact_info' => empty($contactInfo) ? null : json_encode($contactInfo),
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);
        }

        // Drop legacy columns if they exist
        if ($hasLegacyColumns) {
            Schema::table('users', function (Blueprint $table) {
                $columnsToDrop = ['job_title', 'phone', 'location', 'linkedin_url', 'github_url'];
                foreach ($columnsToDrop as $col) {
                    if (Schema::hasColumn('users', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Re-add columns to users before dropping user_profiles
        Schema::table('users', function (Blueprint $table) {
            $table->string('job_title')->nullable()->after('email');
            $table->string('phone')->nullable()->after('job_title');
            $table->string('location')->nullable()->after('phone');
            $table->string('linkedin_url')->nullable()->after('location');
            $table->string('github_url')->nullable()->after('linkedin_url');
        });

        // Migrate data back
        $profiles = DB::table('user_profiles')->get();
        foreach ($profiles as $profile) {
            $contact = $profile->contact_info ? json_decode($profile->contact_info, true) : [];
            DB::table('users')->where('id', $profile->user_id)->update([
                'job_title'    => $profile->headline,
                'phone'        => $contact['phone'] ?? null,
                'location'     => $profile->location,
                'linkedin_url' => $contact['linkedin_url'] ?? null,
                'github_url'   => $contact['github_url'] ?? null,
            ]);
        }

        Schema::dropIfExists('user_profiles');
    }
};
