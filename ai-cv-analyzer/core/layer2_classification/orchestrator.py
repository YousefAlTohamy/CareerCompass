import logging
from typing import Dict, Any
from core.layer2_classification.domain_engine import DomainEngine
from core.layer2_classification.seniority_engine import SeniorityEngine
from core.layer2_classification.skill_engine import SkillEngine
from core.layer2_classification.classifier import CVDomainClassifier

logger = logging.getLogger(__name__)

class ClassificationOrchestrator:
    """
    Orchestrator for Layer 2: Classification and Enrichment.
    Coordinates Domain, Seniority, and Skill analysis.
    """
    
    def __init__(self, classifier: CVDomainClassifier):
        self._domain_engine = DomainEngine(classifier)
        self._seniority_engine = SeniorityEngine(classifier._embedder)
        self._skill_engine = SkillEngine()

    def enrich_cv_analysis(self, cv_data: dict) -> dict:
        """
        Runs the full classification pipeline and enriches the cv_data.
        """
        logger.info("🎬 Layer 2: Starting enrichment for %s", cv_data.get("filename", "unknown"))
        
        # 1. Domain Classification
        domain_scores = self._domain_engine.predict_domain(cv_data)
        primary_domain = max(domain_scores, key=domain_scores.get)
        
        # 2. Seniority Analysis
        seniority_results = self._seniority_engine.analyze_seniority(cv_data)
        
        # 3. Skill Categorization
        skills_list = cv_data.get("skills", {}).get("items", [])
        categorized_skills = self._skill_engine.categorize_skills(skills_list)
        
        # Enrich the final object
        if "analysis" not in cv_data:
            cv_data["analysis"] = {}
            
        cv_data["analysis"]["predicted_role"] = cv_data.get("profile", {}).get("current_title")
        cv_data["analysis"]["primary_domain"] = primary_domain
        cv_data["analysis"]["seniority"] = seniority_results["level"]
        
        # Add metadata for debugging/transparency
        if "metadata" not in cv_data["analysis"]:
            cv_data["analysis"]["metadata"] = {}
            
        cv_data["analysis"]["metadata"]["seniority_details"] = seniority_results
        cv_data["analysis"]["metadata"]["categorized_skills"] = categorized_skills
        cv_data["analysis"]["metadata"]["domain_scores"] = domain_scores
        
        logger.info("✅ Layer 2: Enrichment complete. Seniority=%s, Domain=%s", 
                    seniority_results["level"], primary_domain)
        
        return cv_data
