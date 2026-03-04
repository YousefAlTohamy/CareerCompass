# 🧠 CareerCompass AI Engine (v2.0 - Next Generation)

Welcome to the new, isolated workspace for the **CareerCompass AI Engine v2**. 
This workspace is created to build, train, and test the heavy Machine Learning (ML) features without disrupting the current `ai-engine` used by the rest of the team. Once this v2 engine is fully tested and verified, it will replace the existing one.

---

## 🎯 The Vision: From Hardcoded Rules to Artificial Intelligence
The previous system relied on exact keyword matching (if CV has "Python" and Job needs "Python", match = true) and brittle CSS selectors for scraping.

**AI Engine v2** transforms this into a proper **3-Layer Intelligence System**, showcasing true Computer Science depth (NLP, Transformers, Embeddings, Graph Theory, and Multi-class Classification).

---

## 🏗️ Core 3-Layer Architecture

### 1️⃣ Layer 1: Universal Understanding & OCR [COMPLETED]
**Goal:** Convert any document format (PDF, DOCX, JPG) into a Structured JSON Schema.
*   **The Brain (NER Model):** A fine-tuned **Transformer-based Named Entity Recognition** model (DistilBERT).
*   **Methodology:** Uses **BIO Tagging** (Beginning, Inside, Outside) to extract entities regardless of position.
*   **OCR Support:** Integrated **PyMuPDF** and **EasyOCR** for handling scanned documents and images.

### 2️⃣ Layer 2: Professional Domain Classification [COMPLETED]
**Goal:** Mathematically categorize a candidate into a specific industry/domain.
*   **The Brain (NLI/Classifier):** Utilizes a **Zero-Shot Classification** approach (BART-Large-MNLI) to route candidates.
*   **Logic:** Outputs a probability distribution across domains (e.g., *Backend Development: 0.92, UI/UX: 0.04*).

### 3️⃣ Layer 3: Semantic Matching Engine [COMPLETED]
**Goal:** Match CVs to Job Descriptions based on "Meaning" (Semantic) rather than "Keywords" (Lexical).
*   **The Brain:** **Sentence-BERT (SBERT)** for producing high-dimensional dense embeddings.
*   **The Math:** **Cosine Similarity** calculation between the CV Vector and the Job Description Vector.
*   **Optional Edge:** A *Skill Knowledge Graph* can provide a secondary "Proximity Score".

---

## 📂 Proposed Folder Structure

Since this is a fresh start, we will maintain an enterprise-level folder structure:

```text
ai-engine-v2/
│
├── README.md               # You are reading this
├── requirements.txt        # Isolated dependencies for v2
├── main.py                 # The FastAPI Gateway
│
├── core/                   # The 3 Layers of Intelligence
│   ├── layer1_understanding/
│   │   ├── ocr_pipeline.py # Handles Images/PDFs
│   │   └── ner_engine.py   # Transformer NLP logic
│   │
│   ├── layer2_classification/
│   │   └── classifier.py   # Probability domain routing
│   │
│   └── layer3_matching/
│       ├── embedder.py     # Sentence-BERT vector generation
│       └── similarity.py   # Math and Scoring logic
│
└── models/                 # Saved weights (.pth, .bin) [Git Ignored]
```

---

## 🧠 Phase 3: Model Fine-Tuning (Autonomous Strategy)

To ensure the project is independent of private/gated external datasets, we implemented a **Synthetic Data Augmentation** strategy:

1.  **Synthetic Engine**: A custom Python engine generates 5,000+ realistic, BIO-tagged resume samples (Skills, Roles, Experience).
2.  **Infrastructure**: Training is handled via **Google Colab** (T4 GPU) to fine-tune `distilbert-base-cased`.
3.  **Auto-Detection**: The AI Engine (`ner_engine.py`) has a built-in detection layer:
    *   It looks for `models/ner_weights/career_compass_ner_final/`.
    *   If found: It loads the custom high-accuracy weights.
    *   If not: It falls back to a generic model to ensure the system never crashes.
4.  **Verification**: The Colab notebook generates an **F1-Score Validation Report** for project documentation.

---

## 🛠️ Troubleshooting & Engineering Solutions

During development, we encountered several "Real-World" challenges that were solved using advanced engineering techniques:

| Opportunity/Challenge | Solution Implemented | Technical Term |
| :--- | :--- | :--- |
| **Dataset Inaccessibility** | Developed a custom **Synthetic Data Engine** to generate 5,000+ labeled resume samples. | *Data Augmentation* |
| **Library Version Conflicts** | Resolved `TypeError` in `transformers` v4.46+ by updating `evaluation_strategy` → `eval_strategy`. | *API Lifecycle Management* |
| **Missing Model Parameters** | Updated `Trainer` initialization to use `processing_class` instead of the deprecated `tokenizer` param. | *Backward Compatibility Fix* |
| **OCR Resource Intensity** | Implemented a fallback mechanism between `PyMuPDF` (text-based) and `EasyOCR` (image-based). | *Multi-Modal Fallback* |
| **Deployment Port Conflicts** | Moved AI-Engine v2 to Port `8002` to allow parallel testing with Legacy v1 on `8001`. | *Port Orchestration* |

---

---

## 📈 Model Evaluation & Accuracy Metrics

For a CS Graduation project, "Accuracy" is not just a percentage; it is measured using three scientific metrics provided in our training reports:

1.  **Precision (الدقة):** Out of all the skills the model identified, how many were *actually* skills? (Avoids "Hallucinations").
2.  **Recall (الاستدعاء):** Out of all the skills present in the CV, how many did the model *manage to find*? (Avoids "Missing Data").
3.  **F1-Score (المعدل المتوازن):** The harmonic mean of Precision and Recall. This is the **Gold Standard** metric for NER models.

### How we validate:
*   **Validation Set:** During training in Google Colab, we set aside 20% of the data (1,000 samples) that the model never saw before.
*   **Evaluation:** The model is tested against this "Unseen" data after every epoch (round) to ensure it is learning patterns, not just memorizing.
*   **Target:** Our synthetic training strategy aims for an **F1-Score of >90%**, ensuring professional-grade reliability.

---

## 📈 Scalability & Future Expansion

The AI Engine v2 is architected for continuous growth. To expand the model's capabilities:

1.  **Vertical Scaling (Data):** 
    *   Expand `SKILLS` and `ROLES` dictionaries in `train_ner.ipynb`.
    *   Increase training samples from 5,000 to **50,000+** to capture more linguistic variety.
    *   Integrate real-world datasets (like *CoNLL-2003* or *JobStack*) as secondary training sources.
2.  **Architectural Upgrading:**
    *   Swap `distilbert-base-cased` for larger models like `bert-base-cased` or `roberta-large` for higher complex-entity recognition.
3.  **Entity Expansion:**
    *   Add new tags (e.g., `EDUCATION`, `CERTIFICATIONS`, `GPA`) by updating the `ner_tags` mapping in the synthetic engine.
4.  **Hardware Acceleration:**
    *   Move from Colab T4 to A100/H100 GPUs for faster training on massive datasets.

---

## 📘 Technical Glossary for Graduation Defense

*   **NER (Named Entity Recognition):** A sub-task of NLP that locates and classifies named entities in unstructured text into pre-defined categories.
*   **BIO Tagging:** A common tagging format for labeling tokens in NER (B-Begin, I-Inside, O-Outside).
*   **Embeddings:** Numerical representations of text in a high-dimensional vector space where semantically similar words are closer together.
*   **Cosine Similarity:** A metric used to measure how similar two vectors are, regardless of their size (The core of our Matcher).
*   **Fine-Tuning:** The process of taking a pre-trained model and training it further on a domain-specific dataset (Resume data).
*   **Synthetic Data:** Artificially generated data that mimics the statistical properties of real-world data, used when real data is scarce or restricted.

---

## 🚀 Future Roadmap: Phase 4
*   [ ] **AI-Driven Universal Scraper:** An autonomous engine that navigates job boards to extract live data without predefined CSS selectors.
*   [ ] **Knowledge Graph Integration:** Connecting extracted skills to a map of professional relationships.

---

## 🚀 Current Status & Next Steps

### ✅ Completed
1.  **Architecture Setup**: The 3-Layer Engine (Understanding, Classification, Matching) is fully coded in `core/`.
2.  **API Gateway**: `main.py` is ready to serve the FastAPI endpoints (`/api/v2/analyze-cv` and `/api/v2/match-job`).
3.  **Auto-Detection ML**: Added intelligent loading in `ner_engine.py` to seamlessly fallback to a generic model if the custom `career_compass_ner_final` weights are not yet downloaded from the Colab training.

### 🔄 What's Next? (Phase 4: The AI Scraper)
Our next major goal is replacing the brittle CSS-based scraper with an **AI-Driven Universal Scraper**.
1.  **Objective**: Automatically extract Job Title, Requirements, and Skills from *any* HTML page without relying on hardcoded class names.
2.  **Strategy**: Utilize a Large Language Model (LLM) or a specialized extraction model to parse the DOM tree intelligently.
