# 🧪 Testing Your Custom AI Engine (Guide)

Now that your "AI Brain" is trained and active, here is how you can perform a real-world test using any CV file (PDF, Image, or Word).

---

## Option 1: Using the Terminal (cURL)

Open a **new** terminal (keep the one running `main.py` open) and run this command:

```bash
# Replace 'my_cv.pdf' with the actual path to your CV
curl -X POST "http://127.0.0.1:8002/api/parse-cv" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@my_cv.pdf"
```

---

## Option 2: Using a Web Browser (Swagger UI)

FastAPI comes with a built-in testing interface:
1.  Open your browser and go to: `http://127.0.0.1:8002/docs`
2.  Click on the **POST /api/parse-cv** endpoint.
3.  Click **Try it out**.
4.  Choose your CV file and click **Execute**.

---

## Option 3: Model-Only Verification (Bypasses FastAPI)

Test the fine-tuned NER model directly without running the FastAPI server. This is useful for verifying that the model weights are correctly loaded and producing expected entity categories.

```bash
cd ai-cv-analyzer
python tests/test_local_model.py
```

**What this script does:**
1. Loads `models/ner_weights/career_compass_ner_final` directly via `transformers.pipeline("ner")`
2. Runs inference on a sample CV text (embedded in the script)
3. Filters and prints `SKILL` and `ROLE` entities with confidence scores

**Expected output:**
```
⏳ Loading Career Compass AI Model...
🔍 Analyzing CV...

✅ Extracted Entities:
----------------------------------------
🔸 SKILL   : PHP (Confidence: 95.23%)
🔸 SKILL   : Laravel (Confidence: 93.87%)
🔸 ROLE    : Backend Developer (Confidence: 91.45%)
```

> **Note**: This script requires the fine-tuned model to be present at `models/ner_weights/career_compass_ner_final/`. If you haven't trained or deployed the model yet, run `python scripts/deploy_model.py` first.

---

## Option 4: Phase Verification Scripts (Recommended for Deep Testing)

The `scripts/` directory contains 5 dedicated verification scripts that test each phase of the V3 pipeline in isolation using mocked spatial extraction. These tests run the **actual NER engine and orchestrator** against controlled input.

### How to run:

```bash
cd ai-cv-analyzer
python scripts/verify_phase1.py
python scripts/verify_phase2.py
python scripts/verify_phase3.py
python scripts/verify_phase4.py
python scripts/verify_phase5.py
```

### What each phase tests:

| Script | Tests | Key Assertions |
|---|---|---|
| **verify_phase1.py** | PDF CID artifact stripping, skill extraction refinement, training prompt validation | `(cid:153)` patterns are removed; valid unlisted skills like "Cypress" are kept |
| **verify_phase2.py** | NER-aware name extraction, label de-confliction (skills vs roles vs orgs) | "Yousef Altohamy" extracted via NER entities; overlapping role/org names removed from skills |
| **verify_phase3.py** | Date regex + total experience years, description bullet scrubbing | "Present" maps to `date.today()`; total years > 5.0; role/company stripped from bullets |
| **verify_phase4.py** | Fine-tuned model loading, name confidence (≥0.90), full orchestrator benchmark | Local model path detected; skills don't contain roles/orgs; experience years > 0 |
| **verify_phase5.py** | Singleton pattern, massive file stress test (50K words), error handling, response time | NER engine is singleton; 50K-word file in <10s; corrupted PDF returns `parsing_status="error"`; standard CV in <5s |

### Expected output (per script):
Each test prints `SUCCESS` or `FAILURE` per assertion. All tests should show `SUCCESS` for a correctly configured pipeline.

```
--- 1. Verify Spatial Parser Cleanup ---
Original: This is a test (cid:153) pdf extraction.
Cleaned:  This is a test   pdf extraction.
SUCCESS: PDF CID artifacts successfully stripped.

--- 2. Verify Skill Extraction Refinement ---
Skill 'Cypress' kept?: True
SUCCESS: Strict whitelists removed. Valid unlisted skills are kept.
```

---

## Option 5: Legacy test_cv.py (⚠️ Stale)

> **Warning**: `tests/test_cv.py` references the legacy `/api/v2/analyze-cv` endpoint and reads response keys (`layer1_understanding`, `layer2_classification`, `metadata`) that **no longer exist** in the current V3 `CVParseResult` schema. This script will **404** if run against the current server.

If you need end-to-end HTTP testing, use the **Swagger UI** (Option 2) or **cURL** (Option 1) with the correct `/api/parse-cv` endpoint instead.

---

## 📈 What to Look For in the V3 Results

The V3 pipeline returns a strict `CVParseResult` JSON. Here are the key fields to inspect:

| Field | What to Check |
|---|---|
| `parsing_status` | Should be `"success"` for valid CVs |
| `profile.full_name` | Extracted name (NER-based, high confidence) |
| `profile.current_title` | Most recent/relevant role detected |
| `profile.contact.email` | Extracted email address (regex-based) |
| `profile.contact.phone` | Extracted phone number (international format support) |
| `profile.contact.linkedin_url` | LinkedIn profile URL (auto-prefixed with `https://`) |
| `profile.contact.github_url` | GitHub profile URL |
| `skills.items` | Array of `SkillItem` objects — check `name`, `confidence_score`, `evidence` |
| `skills.confidence_score` | Aggregate confidence across all extracted skills |
| `experience.items` | Array of `ExperienceItem` — check `title`, `company`, `start_date`, `end_date`, `is_current` |
| `analysis.predicted_role` | Best-guess current professional role |
| `analysis.metadata.experience.total_experience_years` | Calculated years from date ranges |
| `analysis.metadata.extraction.spatial_status` | Should be `"ok"` — confirms PDF text was extracted |
| `stats.page_count` | Number of pages in the uploaded document |
| `stats.word_count` | Total word count from spatial extraction |

### Example snippet from a successful response:

```json
{
  "parsing_status": "success",
  "profile": {
    "full_name": "Yousef Altohamy",
    "current_title": "Backend Developer",
    "contact": {
      "email": "yousef@example.com",
      "phone": "+20 101 234 5678",
      "linkedin_url": "https://linkedin.com/in/yousefalto",
      "github_url": "https://github.com/yousefalto"
    }
  },
  "skills": {
    "items": [
      {"name": "Laravel", "confidence_score": 0.92, "category": "hard", "evidence": "ner"},
      {"name": "Docker", "confidence_score": 0.88, "category": "hard", "evidence": "ner"}
    ],
    "confidence_score": 0.87
  },
  "analysis": {
    "predicted_role": "Backend Developer",
    "metadata": {
      "experience": {"total_experience_years": 3.5}
    }
  }
}
```
