import sys
import re
import os

sys.path.append(os.path.dirname(__file__))

from core.layer1_understanding.advanced_ner import _should_keep_skill

def verify():
    print("--- 1. Verify spatial_parser.py regex ---")
    with open('core/layer1_understanding/spatial_parser.py', 'r') as f:
        content = f.read()
        if "re.sub(r'\\(cid:\\d+\\)', ' ', text)" in content:
            print("SUCCESS: Regex cleaning logic found in spatial_parser.py")
        else:
            print("FAILURE: Regex cleaning logic NOT found in spatial_parser.py")

    text = "Developer (cid:263) Python"
    cleaned = re.sub(r'\(cid:\d+\)', ' ', text).strip()
    print(f"Test regex directly: '{text}' -> '{cleaned}'")
    if cleaned == "Developer   Python" or cleaned == "Developer Python":
         print("SUCCESS: (cid:...) regex matches correctly.")

    print("\n--- 2. Verify _should_keep_skill ---")
    keep_redis = _should_keep_skill("Redis", 0, 1, [], window=3)
    print(f"Keep 'Redis': {keep_redis}")
    if keep_redis:
        print("SUCCESS: 'Redis' is kept")
    else:
        print("FAILURE: 'Redis' was dropped")

    keep_c = _should_keep_skill("C", 0, 1, [], window=3)
    print(f"Keep 'C': {keep_c}")

    keep_123 = _should_keep_skill("123", 0, 1, [], window=3)
    print(f"Keep '123': {keep_123}")
    
    print("\n--- 3. Verification of generate_tech_dataset.py ---")
    with open('training/generate_tech_dataset.py', 'r') as f:
        content = f.read()
        if "generate high-quality, full sentences (CV snippets). Do NOT pre-tokenize the text." in content.lower() or "generate high-quality, full sentences" in content:
            print("SUCCESS: New prompt is present in generate_tech_dataset.py")
        else:
             print("FAILURE: New prompt not found.")

if __name__ == '__main__':
    verify()
