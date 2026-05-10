import logging
from typing import Dict, List, Optional
from core.layer2_classification.classifier import CVDomainClassifier
from core.layer2_classification.utils import load_taxonomy

logger = logging.getLogger(__name__)

class DomainEngine:
    """
    Engine for classifying CVs into career domains.
    Uses zero-shot classification via BERT against a dynamic taxonomy loaded from JSON.
    """
    
    def __init__(self, classifier: CVDomainClassifier):
        self._embedder = classifier.embedder
        taxonomy = load_taxonomy()
        self._general_taxonomy = taxonomy["domain_taxonomy"]["General"]
        self._tech_taxonomy = taxonomy["domain_taxonomy"]["Technology"]
        self._all_domains = {**self._general_taxonomy, **self._tech_taxonomy}

    def predict_domain(self, cv_data: dict) -> Dict[str, float]:
        """
        Predicts the primary industry domain using semantic similarity.
        """
        # 1. Prepare CV text for comparison
        profile = cv_data.get("profile", {})
        experience = cv_data.get("experience", {}).get("items", [])
        
        # Combine summary and recent job titles for context
        recent_titles = " ".join([it.get("title", "") for it in experience[:2]])
        cv_text = f"{profile.get('current_title', '')} {recent_titles} {profile.get('summary', '')}"
        cv_text = cv_text[:1000] # Limit context window
        
        # 2. Semantic Comparison against all domains in taxonomy
        scores = {}
        for domain_name, description in self._all_domains.items():
            # Use BERT to compare CV text vs Domain description
            similarity = self._embedder.compute_similarity(cv_text, description)
            scores[domain_name] = float(similarity)
            
        return scores

    def identify_tech_specialty(self, skills: list, titles: list) -> Optional[str]:
        """
        Currently specialties are handled within the main predict_domain call 
        as they are part of the full taxonomy.
        """
        return None
