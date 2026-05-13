<?php

namespace App\Console\Commands;

use App\Models\Job;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CalculateSkillImportance extends Command
{
    protected $signature = 'skills:calculate-importance
                            {--role= : Specific job role to calculate (optional)}
                            {--all : Calculate for all job titles}';

    protected $description = 'Calculate skill importance scores based on job market frequency';

    public function handle(): int
    {
        $this->info('Calculating skill importance scores...');

        try {
            if ($this->option('role')) {
                // Calculate for specific role
                $role = $this->option('role');
                $this->info("Calculating for role: {$role}");
                $this->calculateForRole($role);
            } elseif ($this->option('all')) {
                // Calculate for all distinct job titles
                $this->info('Calculating for all job titles...');
                $jobTitles = Job::distinct('title')->pluck('title');

                $bar = $this->output->createProgressBar($jobTitles->count());
                $bar->start();

                foreach ($jobTitles as $title) {
                    $this->calculateForRole($title);
                    $bar->advance();
                }

                $bar->finish();
                $this->newLine(2);
            } else {
                $this->error('Please specify either --role=<title> or --all');
                return 1;
            }

            $this->info('✓ Skill importance calculation completed!');
            return 0;
        } catch (\Exception $e) {
            $this->error('Error: ' . $e->getMessage());
            Log::error('Skill importance calculation failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return 1;
        }
    }

    /**
     * Calculate skill importance for a specific job role using SQL aggregation.
     * This approach uses ~0 RAM compared to loading models into PHP arrays.
     */
    protected function calculateForRole(string $jobTitle): void
    {
        // Get total jobs count for this title
        $totalJobs = Job::where('title', 'like', "%{$jobTitle}%")->count();

        if ($totalJobs === 0) {
            $this->warn("No jobs found for: {$jobTitle}");
            return;
        }

        // Use SQL aggregation to count skill frequencies directly in database
        // This is MUCH more efficient than loading models into PHP
        $skillStats = DB::table('job_skills')
            ->join('job_postings', 'job_skills.job_id', '=', 'job_postings.id')
            ->where('job_postings.title', 'like', "%{$jobTitle}%")
            ->select(
                'job_skills.skill_id',
                DB::raw('COUNT(*) as skill_count'),
                DB::raw('COUNT(DISTINCT job_skills.job_id) as job_count')
            )
            ->groupBy('job_skills.skill_id')
            ->get();

        if ($skillStats->isEmpty()) {
            $this->warn("No skills found for jobs with title: {$jobTitle}");
            return;
        }

        $updatedCount = 0;

        // Process each skill's statistics
        foreach ($skillStats as $stat) {
            $percentage = ($stat->job_count / $totalJobs) * 100;

            // Determine category based on percentage
            $category = 'nice_to_have';
            if ($percentage > 70) {
                $category = 'essential';
            } elseif ($percentage >= 40) {
                $category = 'important';
            }

            // Update all records for this skill in this role using a single UPDATE query
            $updated = DB::table('job_skills')
                ->join('job_postings', 'job_skills.job_id', '=', 'job_postings.id')
                ->where('job_postings.title', 'like', "%{$jobTitle}%")
                ->where('job_skills.skill_id', $stat->skill_id)
                ->update([
                    'job_skills.importance_score' => round($percentage, 2),
                    'job_skills.importance_category' => $category,
                    'job_skills.updated_at' => now(),
                ]);

            $updatedCount += $updated;
        }

        $this->line("  {$jobTitle}: {$totalJobs} jobs, {$updatedCount} skill-job relationships updated");

        Log::info("Calculated skill importance for {$jobTitle}", [
            'total_jobs' => $totalJobs,
            'unique_skills' => $skillStats->count(),
            'updated_records' => $updatedCount,
        ]);
    }
}
