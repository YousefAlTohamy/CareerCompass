# 📚 CareerCompass Model Training Guide

To achieve the "Computer Science Edge" for your Graduation Project, you need to prove your AI model is fine-tuned, not just an API call. We created `training/train_ner.ipynb` for this exact purpose.

Follow these steps exactly to run the Cloud Training using Google's free GPUs:

---

## Step 0: Dataset Generation Pipeline (Local Machine)

Before training, you need to generate and clean the dataset. This step runs **locally** on your machine (not in Colab).

### 0a. Configure Environment

```bash
cd ai-cv-analyzer
cp .env.example .env
# Edit .env and add your Gemini API key(s):
# GEMINI_API_KEYS=key1,key2,key3   (comma-separated for rotation)
```

### 0b. Generate Synthetic Training Data

```bash
python training/generate_tech_dataset.py
```

This script uses **Google Gemini API** with multi-key rotation across 14+ model variants (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash`, etc.) to generate **50,000 synthetic NER samples**.

**Distribution**: 80% positive samples (real CV bullet points with annotated entities) + 20% negative/decoy samples (tech words used in non-skill contexts — entities list is `[]`).

**Output**: `training/train_real_tech.json` (~14 MB, JSONL format)

**Expected format per line:**
```json
{
  "text": "• Built scalable REST APIs using Node.js and deployed via Docker on AWS EC2.",
  "entities": [
    {"text": "Node.js", "label": "SKILL"},
    {"text": "Docker", "label": "SKILL"},
    {"text": "AWS EC2", "label": "SKILL"}
  ]
}
```

### 0c. Clean the Dataset

```bash
python training/clean_dataset.py
```

This script performs:
- **Whitespace normalization** (hidden chars, double spaces, multiple newlines)
- **Deduplication** by exact text match
- **Entity span validation** (ensures entity text exists in the sentence)
- **Greedy SKILL filter** (removes SKILL entities > 3 words)
- **Negative sample preservation** (decoy samples with empty `entities` are kept)

**Output**: `training/train_real_tech_cleaned.json` (~13 MB)

### 0d. (Optional) Check Available Gemini Models

```bash
python training/check-models.py
```

Lists all models accessible for your API key. Useful for troubleshooting rate limits.

---

## Step 1: Access Google Colab
1. Open your web browser and go to [Google Colab](https://colab.research.google.com/).
2. You will be prompted to sign in with your Google account.

## Step 2: Upload Files
1. When the Colab welcome popup appears, click on the **"Upload"** tab.
2. Click **"Browse"** and upload the following two files from your local `ai-cv-analyzer/training/` folder:
   - `train_ner.ipynb` (The training notebook)
   - `train_real_tech_cleaned.json` (The cleaned training dataset from Step 0c)
3. Colab will open the notebook automatically. Ensure `train_real_tech_cleaned.json` is visible in the file sidebar.

## Step 3: Enable the Free GPU (Critical)
Training an AI Model on a CPU takes days. We must enable the Tesla T4 GPU.
1. In the top menu bar of Colab, click on **Runtime**.
2. Select **Change runtime type**.
3. Under the "Hardware accelerator" dropdown, select **T4 GPU** (or just GPU).
4. Click **Save**.

## Step 4: Run the Training Process
1. Look at the top menu bar again and click on **Runtime**.
2. Select **Run all** (or press `Ctrl+F9`).
3. Google Colab will execute the code cell by cell:
   - It installs the libraries (`torch`, `transformers`, `datasets`, `seqeval`, `evaluate`, `accelerate`).
   - **Data Loading**: It loads `train_real_tech_cleaned.json` and prepares the 11 BIO labels.
   - **Tokenization**: Uses `bert-base-cased` tokenizer with offset-mapping-based label alignment (`max_length=512`).
   - **Verification**: A verification cell prints the Token–Label alignment table to confirm correct mapping.
   - It begins the training using the hyperparameters below.
4. **Wait:** This process will take approximately **20-40 minutes on T4 GPU**. DO NOT close the tab. You will see progress bars indicating loss and accuracy metrics.

### Hyperparameters (Actual)

| Parameter | Value | Notes |
|---|---|---|
| `base_model` | `bert-base-cased` | Hugging Face checkpoint (NOT `dslim/bert-base-NER`) |
| `num_train_epochs` | `5` | Maximum epochs (may terminate earlier via early stopping) |
| `learning_rate` | `2e-5` | AdamW optimizer default |
| `per_device_train_batch_size` | `16` | Per-GPU batch size |
| `per_device_eval_batch_size` | `16` | Evaluation batch size |
| `weight_decay` | `0.01` | L2 regularization |
| `eval_strategy` | `"epoch"` | Evaluate at end of each epoch |
| `save_strategy` | `"epoch"` | Save checkpoint at end of each epoch |
| `save_total_limit` | `2` | Keep only last 2 checkpoints (disk space) |
| `load_best_model_at_end` | `True` | Loads best checkpoint by F1 score |
| `metric_for_best_model` | `"f1"` | seqeval F1 score |
| `EarlyStoppingCallback` | `patience=3` | Stops if F1 doesn't improve for 3 consecutive epochs |
| `train/test split` | `90/10` | `seed=42` |

## Step 5: Automated Export
1. Once the training completes and evaluation results appear, the final cell will execute.
2. **Auto-Download**: The notebook is programmed to automatically zip the folder `career_compass_ner_final` and trigger a browser download for `career_compass_ner_final.zip`.
3. If the download doesn't trigger, right-click `career_compass_ner_final.zip` in the sidebar and select **Download**.

## Step 6: Add to Your Graduation Project
1. Extract the downloaded `career_compass_ner_final.zip`.
2. Go to your local machine: `Graduation-project \ ai-cv-analyzer \ models \ ner_weights \`.
3. Paste the `career_compass_ner_final` folder right there.
4. Restart your FastAPI server on port `8002`. The NER engine (`advanced_ner.py`) will automatically detect your custom model, proving your technical depth to the committee!

---

## 🏷️ BIO Label Scheme (11 Labels)

The model uses the standard **BIO** (Begin, Inside, Outside) tagging format:

| Label | Meaning |
|---|---|
| `O` | Outside — not part of any entity |
| `B-SKILL` | Beginning of a technical skill entity |
| `I-SKILL` | Inside/continuation of a SKILL entity |
| `B-ROLE` | Beginning of a professional role/title |
| `I-ROLE` | Inside/continuation of a ROLE entity |
| `B-EDU` | Beginning of an education entity |
| `I-EDU` | Inside/continuation of an EDU entity |
| `B-CERT` | Beginning of a certification entity |
| `I-CERT` | Inside/continuation of a CERT entity |
| `B-SOFT` | Beginning of a soft skill entity |
| `I-SOFT` | Inside/continuation of a SOFT entity |

### 🎯 Categories Recognized
Your model is now fine-tuned to extract:
- **SKILL**: Hard technical skills (e.g., Python, Docker, AWS EC2).
- **SOFT**: Interpersonal traits (e.g., Leadership, Problem Solving).
- **ROLE**: Professional titles (e.g., Senior Backend Developer, QA Lead).
- **EDU**: Educational degrees (e.g., B.Sc. Computer Science).
- **CERT**: Industry certifications (e.g., AWS Certified Solutions Architect).

---

## 📊 Metrics & Evaluation

The training notebook computes 4 metrics via the `seqeval` library after each epoch:

| Metric | Description |
|---|---|
| **Precision** | Of all entities the model *predicted*, how many were correct |
| **Recall** | Of all entities that *exist*, how many did the model find |
| **F1** | Harmonic mean of Precision and Recall (primary selection metric) |
| **Accuracy** | Token-level accuracy across all BIO labels |

The **best model** is selected by the highest **F1 score** across all training epochs (via `load_best_model_at_end=True`).

---

## 🛠️ Utility Scripts

### `scripts/deploy_model.py` — Quick Local Deployment (No Training Required)

Downloads `dslim/bert-base-NER`, resizes the classification head to the 11 custom labels, and saves to `models/ner_weights/career_compass_ner_final/`. Useful for testing the NER pipeline without running the full Colab training.

```bash
cd ai-cv-analyzer
python scripts/deploy_model.py
```

### `scripts/patch_nb.py` — Notebook Patcher

Programmatically patches `training/train_ner.ipynb` to:
1. Fix `TrainingArguments` (sets `evaluation_strategy="epoch"`, `save_strategy="epoch"`, removes deprecated `eval_steps`/`save_steps`).
2. Inject a **Token-Label Alignment Verification** cell that prints a `Token | Label` table for the first training sample.

```bash
cd ai-cv-analyzer
python scripts/patch_nb.py
```
