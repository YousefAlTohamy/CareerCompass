<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Skill;
use Illuminate\Support\Facades\File;

class ExportSkillsToJson extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:export-skills-to-json';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Export all skills from the database to a JSON file for the Python AI engine';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $skills = Skill::pluck('name')->toArray();
        
        // Ensure robust path handling to the ai-job-miner service
        $path = base_path('../ai-job-miner/config/standard_skills.json');
        
        $directory = dirname($path);
        if (!File::exists($directory)) {
            File::makeDirectory($directory, 0755, true);
        }
        
        $jsonContent = json_encode($skills, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        
        if (File::put($path, $jsonContent)) {
            $this->info('Successfully exported ' . count($skills) . ' skills to ' . $path);
            return Command::SUCCESS;
        } else {
            $this->error('Failed to write to ' . $path);
            return Command::FAILURE;
        }
    }
}
