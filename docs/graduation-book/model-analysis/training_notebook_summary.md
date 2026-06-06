# Training Notebook Summary

## Notebook Reviewed

File: `ai-cv-analyzer/training/train_ner.ipynb`

The notebook was inspected as a training workflow artifact. It was not executed during this documentation update.

## Training Flow

The notebook is structured for Google Colab:

1. Install PyTorch and Hugging Face training dependencies.
2. Load `train_real_tech_cleaned.json`.
3. Define the BIO label set:
   - O
   - B-SKILL / I-SKILL
   - B-ROLE / I-ROLE
   - B-EDU / I-EDU
   - B-CERT / I-CERT
   - B-SOFT / I-SOFT
4. Split the dataset with a 90/10 train-test split and seed 42.
5. Tokenize with `AutoTokenizer` from `bert-base-cased`.
6. Align character-span entities to token labels.
7. Initialize `AutoModelForTokenClassification` with 11 labels.
8. Train with Hugging Face `Trainer`.
9. Evaluate with sequence-labeling precision, recall, F1, and accuracy.
10. Export the model to `career_compass_ner_final`.

## Hyperparameters Found

| Setting | Value |
|---|---|
| Base checkpoint | `bert-base-cased` |
| Epochs | 5 |
| Learning rate | 2e-5 |
| Train batch size | 16 |
| Eval batch size | 16 |
| Weight decay | 0.01 |
| Save strategy | Each epoch |
| Evaluation strategy | Each epoch |
| Best model metric | F1 |
| Early stopping patience | 3 |
| Max token length | 512 |

## Execution Status

Training was not executed locally because the notebook is designed for a Colab/GPU runtime, the cleaned dataset file is not committed, and the upstream generator requires external Gemini API keys.

The notebook contains metric code, but the committed notebook does not contain final output cells with reproducible metric values.
