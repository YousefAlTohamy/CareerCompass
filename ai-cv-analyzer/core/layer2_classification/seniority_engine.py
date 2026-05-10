import logging
import re
from typing import List, Dict, Any
from core.layer3_matching.embedder import SemanticEmbedder
from core.layer2_classification.utils import load_taxonomy

logger = logging.getLogger(__name__)

class SeniorityEngine:
    """
    Intelligent engine to determine career seniority level.
    Combines AI semantic analysis of summaries with rule-based scoring of experience.
    """
    
    def __init__(self, embedder: SemanticEmbedder):
        self._embedder = embedder
        config = load_taxonomy()["seniority_config"]
        self._labels = config["labels"]
        self._action_verbs = config["action_verbs"]
        self._thresholds = config["thresholds"]

    def analyze_seniority(self, cv_data: dict) -> Dict[str, Any]:
        profile = cv_data.get("profile", {})
        experience = cv_data.get("experience", {}).get("items", [])
        summary = profile.get("summary", "")
        
        verb_score = self._calculate_verb_strength(experience)
        ai_level = self._predict_level_semantically(summary, profile.get("current_title", ""))
        total_years = cv_data.get("analysis", {}).get("metadata", {}).get("experience", {}).get("total_experience_years", 0.0)
        
        final_level = self._resolve_level(ai_level, total_years, verb_score)
        
        return {
            "level": final_level,
            "verb_score": round(verb_score, 2),
            "semantic_match": ai_level
        }

    def _calculate_verb_strength(self, experience: List[Dict]) -> float:
        if not experience: return 0.5
        scores = []
        for item in experience:
            desc = " ".join(item.get("description", [])).lower()
            block_score = 0.5
            for verb, strength in self._action_verbs.items():
                if verb in desc:
                    block_score = max(block_score, strength)
            scores.append(block_score)
        return sum(scores) / len(scores) if scores else 0.5

    def _predict_level_semantically(self, summary: str, title: str) -> str:
        text = f"{title} {summary}"[:500].lower()
        if any(x in text for x in ["intern", "student", "trainee"]): return "Intern"
        if any(x in text for x in ["lead", "head", "manager", "director"]): return "Lead / Manager"
        if any(x in text for x in ["senior", "architect", "expert"]): return "Senior"
        return "Mid-Level"

    def _resolve_level(self, ai_level: str, years: float, verb_score: float) -> str:
        t = self._thresholds
        if ai_level == "Intern" or years < t["intern_max_years"]: return "Intern"
        if years > t["senior_years"] and ai_level == "Mid-Level": return "Senior"
        if verb_score > t["high_verb_score"] and ai_level == "Junior": return "Mid-Level"
        return ai_level
