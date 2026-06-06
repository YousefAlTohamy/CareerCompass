# Synthetic Dataset Generation Summary

## Files Reviewed

- `ai-cv-analyzer/training/generate_tech_dataset.py`
- `ai-cv-analyzer/training/clean_dataset.py`
- `ai-cv-analyzer/docs/HOW_TO_TRAIN_MODEL.md`
- External helper documentation under `D:/Graduation/model-analys-helper`

## Generator Design

The generator uses Gemini API keys read from `.env` as `GEMINI_API_KEYS`. It rotates through keys and model names to create synthetic technical CV snippets.

The prompt asks for technical recruiting-style examples across domains such as backend, frontend, DevOps, mobile, AI/data, cybersecurity, cloud, QA, and networking. It includes noisy CV-like formats such as bullets, summaries, education/certification lines, typos, spacing variations, and unusual headers.

The intended entity labels are:

- SKILL
- SOFT
- ROLE
- EDU
- CERT

The generation plan includes positive labeled examples and negative decoy samples with no entities. This matters because it helps the model learn when not to tag ordinary text.

## Cleaner Design

The cleaner normalizes whitespace, removes duplicate text samples, validates that entity text appears in the sample, filters overly long skill spans, and preserves negative samples.

## Documentation Decision

This update did not run the generator. Running it would require external API keys and would create a large training dataset. No secrets were found in the helper documentation; only placeholder-style mentions such as `GEMINI_API_KEYS=key1,key2,key3` were observed.

The book documents the synthetic generation workflow honestly and does not present generated data as real student CV data.
