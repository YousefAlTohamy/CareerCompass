# NER Token Processing Deep Dive

## Purpose

This note explains how the AI CV Analyzer's NER workflow turns annotated CV text into token labels during training, and how runtime predictions are converted back into useful CV entities.

## Label Set

The notebook defines 11 labels:

| Label | Meaning |
|---|---|
| `O` | Outside any entity. |
| `B-SKILL`, `I-SKILL` | Beginning/inside a technical skill. |
| `B-ROLE`, `I-ROLE` | Beginning/inside a role or job title. |
| `B-EDU`, `I-EDU` | Beginning/inside an education entity. |
| `B-CERT`, `I-CERT` | Beginning/inside a certification entity. |
| `B-SOFT`, `I-SOFT` | Beginning/inside a soft-skill entity. |

## Training Alignment

The notebook loads cleaned JSON examples where each entity has a character span. It tokenizes text with `bert-base-cased`, returns token offsets, and assigns labels as follows:

1. Special tokens receive `-100`, so the loss ignores them.
2. Tokens outside all entity spans receive `O`.
3. The first token in an entity span receives the relevant `B-` label.
4. Later tokens inside the same span receive the relevant `I-` label.
5. The offset mapping is removed before training because the model expects input IDs, attention masks, and token labels.

## Why Casing Matters

The local metadata and notebook indicate a cased tokenizer. This matters for CVs because capitalization helps preserve names, role titles, certificates, organizations, and technology names such as Laravel, Docker, MySQL, AWS, React, and Kubernetes.

## Simplified BIO Example

| Token | Label |
|---|---|
| Experienced | O |
| Backend | B-ROLE |
| Developer | I-ROLE |
| with | O |
| Laravel | B-SKILL |
| Docker | B-SKILL |
| MySQL | B-SKILL |

This table is a simplified explanation. It is not a committed live inference output from the final model.

## Runtime Prediction Handling

`AdvancedNEREngine` loads a token-classification pipeline. It chunks long CV text into 3,500-character windows with overlap so long documents can still be processed. It then:

- merges model tokens,
- cleans subword prefixes,
- expands entity boundaries where appropriate,
- drops contact-like or mostly-symbolic noise,
- filters weak skill candidates,
- deduplicates in original order,
- returns grouped skills, roles, education, certifications, and fallback model labels.

## Training Evidence Limitations

The notebook includes the training and metric logic, but committed cells do not contain final metric outputs. The cleaned training dataset is not committed. The optional local model artifact path is ignored by Git, so live model quality should be evaluated later with a fixed labeled dataset and a supplied artifact.
