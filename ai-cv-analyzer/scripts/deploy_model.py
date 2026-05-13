import os
import sys

# Add custom labels to bert-base-NER and save
# pyrefly: ignore [missing-import]
from transformers import AutoTokenizer, AutoModelForTokenClassification

def deploy_mock_weights():
    # 1. Download base model
    model_name = "dslim/bert-base-NER"
    print(f"Downloading {model_name}...")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    
    # Let's just create a custom model config with our new labels
    label_list = ["O", "B-SKILL", "I-SKILL", "B-ROLE", "I-ROLE", "B-EDU", "I-EDU", "B-CERT", "I-CERT", "B-SOFT", "I-SOFT"]
    id2label = {i: label for i, label in enumerate(label_list)}
    label2id = {label: i for i, label in enumerate(label_list)}

    # We load the model ignoring size mismatches to resize the classification head safely
    model = AutoModelForTokenClassification.from_pretrained(
        model_name,
        num_labels=len(label_list),
        id2label=id2label,
        label2id=label2id,
        ignore_mismatched_sizes=True
    )
    
    output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "models", "ner_weights", "career_compass_ner_final"))
    os.makedirs(output_dir, exist_ok=True)
    
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)
    print(f"✅ Successfully deployed model weights to {output_dir}")

if __name__ == "__main__":
    deploy_mock_weights()
