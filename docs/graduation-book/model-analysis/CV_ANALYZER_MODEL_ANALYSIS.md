# AI CV Analyzer Model Analysis

## Scope

This note summarizes the AI CV Analyzer evidence used to expand the graduation book. It is based on repository files, the external helper documentation folder at `D:/Graduation/model-analys-helper`, and the user-provided exported Colab training-results PDF.

The helper folder existed and contained four top-level folders: `docs`, `layer1`, `layer2`, and `layer3`. Only documentation insight was used. No raw dataset files, images, model weights, or secrets were copied into `docs/graduation-book`.

## Runtime Pipeline

The runtime upload path is:

1. `frontend/src/pages/user/Dashboard.jsx` validates CV file type and size, then posts multipart field `cv`.
2. `backend-api/app/Http/Requests/CvUploadRequest.php` validates PDF/JPEG/PNG files up to 5 MB.
3. `backend-api/app/Services/CvProcessingService.php` forwards the file to the Python analyzer, stores the private CV object, and persists parsed profile, skills, experiences, and `cv_analyses`.
4. `ai-cv-analyzer/main.py` exposes `/api/parse-cv`, handles timeout/error fallback, and calls the orchestrator.
5. `ai-cv-analyzer/core/layer1_understanding/orchestrator.py` coordinates spatial extraction, OCR fallback, segmentation, NER, contact extraction, experience parsing, skill canonicalization, domain/seniority classification, and strict JSON output.
6. `ai-cv-analyzer/core/layer3_matching` supports hybrid matching through semantic similarity, skill matching, domain alignment, constraints, and TF-IDF fallback.

## Model Type

The analyzer is a hybrid CV understanding system. Its NER component is a BERT-family token-classification model, while the complete service also includes deterministic parsing rules and semantic matching logic.

The deployed NER engine prefers the optional local artifact at:

`ai-cv-analyzer/models/ner_weights/career_compass_ner_final`

That model folder is ignored by Git through repository ignore rules. The runtime fallback in `advanced_ner.py` uses `dslim/bert-base-NER` when the local artifact is missing. Training evidence in `train_ner.ipynb` uses `bert-base-cased` as the base checkpoint for fine-tuning, not a from-scratch architecture.

Safe local metadata was inspected from the ignored artifact folder on this workstation. It showed a BERT token-classification configuration, a cased tokenizer, 512-token maximum sequence setting, 12 transformer layers, 768 hidden size, and labels for O plus B/I forms of SKILL, ROLE, EDU, CERT, and SOFT. The binary model weights were not copied into the documentation.

## Custom Project Work

The team-specific customization is visible in:

- CV-specific BIO labels: SKILL, ROLE, EDU, CERT, and SOFT.
- Synthetic technical CV data-generation and cleaning scripts.
- Token-label alignment and Hugging Face Trainer setup in the notebook.
- Optional local exported model loading path.
- Long-CV chunking and span grouping logic.
- Contact, date, experience, and noisy-skill filtering rules.
- Skill canonicalization and domain/seniority classifiers.
- Laravel persistence and frontend visualization of parsed results.

## Recorded Colab Training Evidence

The exported Colab PDF `docs/graduation-book/model-analysis/colab_train_ner_results.pdf` shows output cells from `train_ner.ipynb - Colab`. Visible evidence includes 45,911 loaded rows, a 41,319/4,592 train/test split, 11 BIO labels, `bert-base-cased`, five epochs, learning rate 2e-5, batch size 16, and final epoch metrics: precision 0.933307, recall 0.940521, F1 0.936900, and accuracy 0.976376.

## Evidence Limitation

The repository contains the model-loading code, training workflow, and now the exported Colab metric evidence. It still does not contain committed model weights, committed cleaned training dataset content, per-label metric output, or a confusion matrix. The graduation book therefore reports the Colab-run metrics as training evidence while avoiding production-accuracy or repository-alone reproducibility claims.
