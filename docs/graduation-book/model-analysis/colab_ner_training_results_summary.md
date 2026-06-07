# Colab NER Training Results Summary

## Source

- Source PDF: `docs/graduation-book/model-analysis/colab_train_ner_results.pdf`
- Original local file: `C:/Users/yousef/Downloads/train_ner_colab_results.pdf`
- Visible notebook title: `train_ner.ipynb - Colab`
- Visible export timestamp: `6/7/26, 3:55 AM`
- Notebook heading: `CareerCompass AI Engine: Global Skill NER training (Autonomous)`

## Visible Dataset and Label Evidence

The PDF states that the notebook trains a custom NER model to extract skills and roles and uses a synthetic data augmentation strategy. The visible dataset path is `/content/train_real_tech_cleaned.json`, loaded as `train_real_tech_cleaned.json`.

| Item | Value Visible in PDF |
|---|---:|
| Total generated rows before split | 45,911 |
| Train split rows | 41,319 |
| Test split rows | 4,592 |
| Test size | 0.1 |
| Split seed | 42 |
| Total labels | 11 |

Visible labels: `O`, `B-SKILL`, `I-SKILL`, `B-ROLE`, `I-ROLE`, `B-EDU`, `I-EDU`, `B-CERT`, `I-CERT`, `B-SOFT`, `I-SOFT`.

## Visible Training Configuration

| Parameter | Value Visible in PDF |
|---|---|
| Base checkpoint | `bert-base-cased` |
| Task | token classification / NER |
| Max token length | 512 |
| Epochs | 5 |
| Learning rate | 2e-5 |
| Train batch size | 16 |
| Eval batch size | 16 |
| Weight decay | 0.01 |
| Evaluation strategy | epoch |
| Save strategy | epoch |
| Best-model metric | F1 |
| Early stopping patience | 3 |
| Export folder | `career_compass_ner_final/` |

## Visible Epoch Metrics

| Epoch | Training Loss | Validation Loss | Precision | Recall | F1 | Accuracy |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 0.077623 | 0.069118 | 0.921027 | 0.928206 | 0.924603 | 0.973227 |
| 2 | 0.061530 | 0.064051 | 0.915886 | 0.941504 | 0.928518 | 0.974912 |
| 3 | 0.053831 | 0.063463 | 0.928387 | 0.943469 | 0.935867 | 0.976233 |
| 4 | 0.044553 | 0.064025 | 0.932287 | 0.937967 | 0.935118 | 0.977018 |
| 5 | 0.037280 | 0.068058 | 0.933307 | 0.940521 | 0.936900 | 0.976376 |

## Final Visible Metrics

The final epoch row in the PDF reports:

| Metric | Value |
|---|---:|
| Precision | 0.933307 |
| Recall | 0.940521 |
| F1-score | 0.936900 |
| Accuracy | 0.976376 |
| Training loss | 0.037280 |
| Validation loss | 0.068058 |

## Unavailable from the PDF

- No per-label SKILL/ROLE/EDU/CERT/SOFT classification report is visible in the PDF.
- No confusion matrix is visible in the PDF.
- No per-label support counts are visible beyond the overall train/test row counts.
- The PDF does not include the cleaned dataset content or model weights.

## Interpretation Boundary

These metrics are recorded Colab training-run evidence for the generated/synthetic dataset and notebook validation split visible in the PDF. They are useful evidence that the NER fine-tuning workflow ran and produced measurable validation outputs. They should not be described as production accuracy, a large real-world CV benchmark, or repository-alone reproducible results unless the same dataset, runtime, and exported model artifacts are supplied.
