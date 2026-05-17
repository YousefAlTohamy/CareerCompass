<?php

namespace App\Http\Requests;

use App\Models\ScrapingSource;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreScrapedJobRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     * Sanctum middleware handles authentication at the route level.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Sanitize input data before validation to prevent XSS
     * from untrusted scraped content.
     */
    protected function prepareForValidation(): void
    {
        $fieldsToSanitize = ['description', 'requirements', 'title', 'company', 'location'];

        $sanitized = [];
        foreach ($fieldsToSanitize as $field) {
            if ($this->has($field) && is_string($this->input($field))) {
                // Strip any remaining HTML/script tags that survived the Python pipeline
                $sanitized[$field] = strip_tags($this->input($field));
            }
        }

        foreach (['location', 'salary_range', 'job_type', 'experience', 'requirements', 'work_type', 'source'] as $field) {
            if ($this->has($field) && $this->input($field) === '') {
                $sanitized[$field] = null;
            }
        }

        if ($this->has('job_type') && is_string($this->input('job_type'))) {
            $sanitized['job_type'] = $this->normalizeJobType($this->input('job_type'));
        }

        if ($this->has('work_type') && is_string($this->input('work_type'))) {
            $sanitized['work_type'] = $this->normalizeWorkType($this->input('work_type'));
        }

        if ($this->has('skills') && is_array($this->input('skills'))) {
            $sanitized['skills'] = collect($this->input('skills'))
                ->map(function ($skill) {
                    if (is_array($skill)) {
                        return $skill['name'] ?? $skill['skill'] ?? null;
                    }

                    return $skill;
                })
                ->filter(fn ($skill) => is_string($skill) && trim($skill) !== '')
                ->values()
                ->all();
        }

        if (!empty($sanitized)) {
            $this->merge($sanitized);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'title' => 'required|string|max:255',
            'description' => 'required|string|max:65535',
            'company' => 'required|string|max:255',
            'url' => 'required|url|max:2048',
            'scraping_source_id' => 'nullable|integer|exists:scraping_sources,id',
            'location' => 'nullable|string|max:255',
            'salary_range' => 'nullable|string|max:255',
            'job_type' => 'nullable|string|in:full-time,part-time,contract,internship,freelance,temporary',
            'experience' => 'nullable|string|max:255',
            'requirements' => 'nullable|string|max:65535',
            'skills' => 'nullable|array|max:50',
            'skills.*' => 'string|max:100',
            'work_type' => 'nullable|string|in:remote,hybrid,onsite',
            'source' => 'required_without:scraping_source_id|nullable|string|max:255',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $source = $this->scrapingSource();
            $isDemo = $this->isDemoSource($source);
            $url = (string) $this->input('url', '');

            if (!$isDemo && $this->isCareerCompassLocalUrl($url)) {
                $validator->errors()->add('url', 'Generated CareerCompass URLs are only allowed for demo/local scraping sources.');
            }

            if (!$isDemo && !$this->hasPublicHttpUrl($url)) {
                $validator->errors()->add('url', 'Real external jobs require a valid absolute public HTTP(S) URL.');
            }

            if (!$this->filled('scraping_source_id') && !$this->filled('source')) {
                $validator->errors()->add('source', 'A scraping source id or source name is required.');
            }
        });
    }

    private function scrapingSource(): ?ScrapingSource
    {
        $sourceId = $this->input('scraping_source_id');
        if (!$sourceId) {
            return null;
        }

        return ScrapingSource::find($sourceId);
    }

    private function isDemoSource(?ScrapingSource $source): bool
    {
        $sourceName = strtolower((string) $this->input('source', ''));

        if ($source && (
            in_array($source->type, ['demo', 'local'], true)
            || str_starts_with((string) $source->endpoint, 'demo://')
            || str_contains(strtolower($source->name), 'careercompass demo')
        )) {
            return true;
        }

        return str_contains($sourceName, 'careercompass demo');
    }

    private function hasPublicHttpUrl(string $url): bool
    {
        $parts = parse_url($url);
        if (!is_array($parts)) {
            return false;
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));

        return in_array($scheme, ['http', 'https'], true)
            && $host !== ''
            && !in_array($host, ['localhost', '127.0.0.1'], true);
    }

    private function isCareerCompassLocalUrl(string $url): bool
    {
        $host = strtolower((string) (parse_url($url, PHP_URL_HOST) ?? ''));

        return in_array($host, ['careercompass.local', 'localhost', '127.0.0.1'], true);
    }

    private function normalizeJobType(?string $value): ?string
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        $normalized = strtolower(str_replace('_', '-', trim($value)));
        $normalized = preg_replace('/\s+/', '-', $normalized);

        return [
            'fulltime' => 'full-time',
            'full-time' => 'full-time',
            'permanent' => 'full-time',
            'parttime' => 'part-time',
            'part-time' => 'part-time',
            'contractor' => 'contract',
            'contract' => 'contract',
            'intern' => 'internship',
            'internship' => 'internship',
            'freelance' => 'freelance',
            'temporary' => 'temporary',
            'temp' => 'temporary',
        ][$normalized] ?? 'full-time';
    }

    private function normalizeWorkType(?string $value): ?string
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        $normalized = strtolower(str_replace('_', '-', trim($value)));
        $normalized = preg_replace('/\s+/', '-', $normalized);

        return [
            'remote' => 'remote',
            'work-from-home' => 'remote',
            'telecommute' => 'remote',
            'hybrid' => 'hybrid',
            'onsite' => 'onsite',
            'on-site' => 'onsite',
            'office' => 'onsite',
            'in-person' => 'onsite',
        ][$normalized] ?? 'remote';
    }
}
