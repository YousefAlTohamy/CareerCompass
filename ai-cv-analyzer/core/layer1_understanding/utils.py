import json
import os
from typing import Dict, Any

def load_layer1_config() -> Dict[str, Any]:
    """Loads the Layer 1 understanding configuration from JSON."""
    base_path = os.path.dirname(__file__)
    config_path = os.path.join(base_path, "data", "config.json")
    
    if not os.path.exists(config_path):
        return {}
        
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)
