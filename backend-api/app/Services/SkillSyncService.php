<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Job;
use App\Models\Skill;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SkillSyncService
{
    /**
     * @param array<int, string|array{name?: string, type?: string}> $skills
     * @return Collection<int, Skill>
     */
    public function syncJobSkills(Job $job, array $skills, bool $detaching = false): Collection
    {
        $skillModels = $this->findOrCreateMany($skills);

        $syncData = $skillModels
            ->mapWithKeys(fn (Skill $skill) => [
                $skill->id => [
                    'required' => true,
                    'updated_at' => now(),
                    'created_at' => now(),
                ],
            ])
            ->all();

        $job->requiredSkills()->sync($syncData, $detaching);

        return $skillModels;
    }

    /**
     * @param array<int, string|array{name?: string, type?: string}> $skills
     * @return Collection<int, Skill>
     */
    public function syncUserSkills(User $user, array $skills, bool $detaching = true): Collection
    {
        $skillModels = $this->findOrCreateMany($skills);
        $user->skills()->sync($skillModels->pluck('id')->all(), $detaching);

        return $skillModels;
    }

    /**
     * @param array<int, string|array{name?: string, type?: string}> $skills
     * @return Collection<int, Skill>
     */
    public function findOrCreateMany(array $skills): Collection
    {
        return DB::transaction(function () use ($skills): Collection {
            return collect($skills)
                ->map(fn ($skill) => $this->normalizeSkillPayload($skill))
                ->filter(fn (?array $skill) => $skill !== null)
                ->unique(fn (array $skill) => mb_strtolower($skill['name']))
                ->map(fn (array $skill) => $this->findOrCreateSkill($skill['name'], $skill['type']))
                ->values();
        });
    }

    /**
     * @param string|array{name?: string, type?: string} $skill
     * @return array{name: string, type: string}|null
     */
    private function normalizeSkillPayload(string|array $skill): ?array
    {
        $name = is_array($skill) ? ($skill['name'] ?? '') : $skill;
        $type = is_array($skill) ? ($skill['type'] ?? 'technical') : 'technical';

        $name = $this->normalizeName((string) $name);
        if ($name === null) {
            return null;
        }

        return [
            'name' => $name,
            'type' => $type === 'soft' ? 'soft' : 'technical',
        ];
    }

    public function normalizeName(string $name): ?string
    {
        $name = strip_tags($name);
        $name = preg_replace('/[\x00-\x1F\x7F]/u', '', $name) ?? '';
        $name = trim(preg_replace('/\s+/u', ' ', $name) ?? '');
        $name = Str::limit($name, 100, '');

        if ($name === '') {
            return null;
        }

        $canonical = [
            'api' => 'API',
            'aws' => 'AWS',
            'css' => 'CSS',
            'html' => 'HTML',
            'javascript' => 'JavaScript',
            'js' => 'JavaScript',
            'docker' => 'Docker',
            'laravel' => 'Laravel',
            'ml' => 'ML',
            'mysql' => 'MySQL',
            'php' => 'PHP',
            'python' => 'Python',
            'qa' => 'QA',
            'react' => 'React',
            'react.js' => 'React',
            'reactjs' => 'React',
            'rest api' => 'REST API',
            'rest apis' => 'REST APIs',
            'sql' => 'SQL',
            'typescript' => 'TypeScript',
            'ts' => 'TypeScript',
            'ui' => 'UI',
            'ux' => 'UX',
        ];

        return $canonical[mb_strtolower($name)] ?? $name;
    }

    private function findOrCreateSkill(string $name, string $type): Skill
    {
        $existing = Skill::whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->first();

        if ($existing) {
            if ($existing->type !== $type && $existing->type !== 'technical') {
                $existing->forceFill(['type' => $type])->save();
            }

            return $existing;
        }

        return Skill::create([
            'name' => $name,
            'type' => $type,
        ]);
    }
}
