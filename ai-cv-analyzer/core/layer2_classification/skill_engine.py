import logging
from typing import List, Dict
from core.layer2_classification.utils import load_taxonomy

logger = logging.getLogger(__name__)

class SkillEngine:
    """
    Engine for categorizing and analyzing skills.
    Distinguishes between Hard, Soft, and Management skills using data-driven taxonomy.
    """
    
    def __init__(self):
        config = load_taxonomy()["skill_config"]
        self._soft_skills = set(config["soft_skills"])
        self._mgmt_keywords = config["management_keywords"]
        self._mgmt_exclusions = config["management_exclusions"]

    def categorize_skills(self, skills: List[Dict]) -> Dict[str, List[str]]:
        categorized = {
            "hard_skills": [],
            "soft_skills": [],
            "management_skills": []
        }
        
        for skill in skills:
            name = skill.get("name", "").lower()
            
            # Check for Soft Skills
            if any(ss in name for ss in self._soft_skills):
                categorized["soft_skills"].append(skill["name"])
            # Check for Management
            elif any(ms in name for ms in self._mgmt_keywords):
                # Avoid SQL/State Management
                if not any(ex in name for ex in self._mgmt_exclusions):
                    categorized["management_skills"].append(skill["name"])
            else:
                categorized["hard_skills"].append(skill["name"])
                
        return categorized
