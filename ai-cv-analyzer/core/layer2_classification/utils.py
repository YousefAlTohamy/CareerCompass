import json
import os
from typing import Any, Dict

def load_taxonomy() -> Dict[str, Any]:
    """Loads the Layer 2 taxonomy and configuration from JSON."""
    config_path = os.path.join(os.path.dirname(__file__), "data", "taxonomy.json")
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        # Fallback empty structure to prevent crashes
        print(f"Warning: Failed to load taxonomy from {config_path}: {e}")
        return {
            "domain_taxonomy": {},
            "seniority_config": {"labels": [], "action_verbs": {}, "thresholds": {}},
            "skill_config": {"soft_skills": [], "management_keywords": [], "management_exclusions": []}
        }
