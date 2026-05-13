import logging
import json
import os
from typing import Dict, List, Any
# pyrefly: ignore [missing-import]
import numpy as np

from core.layer3_matching.embedder import SemanticEmbedder
from core.layer2_classification.domain_engine import DomainEngine
from core.layer3_matching.constraint_validator import ConstraintValidator
from core.layer3_matching.fit_analysis_generator import FitAnalysisGenerator

logger = logging.getLogger(__name__)

class IntelligentMatcher:
    """
    Layer 3: The Unified Matchmaking Engine.
    Coordinates semantic scoring, hard constraints, and explainable reporting.
    """

    def __init__(self, embedder: SemanticEmbedder, domain_engine: DomainEngine):
        self._embedder = embedder
        self._domain_engine = domain_engine
        self._validator = ConstraintValidator()
        self._analysis_gen = FitAnalysisGenerator()
        self._config = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        config_path = os.path.join(os.path.dirname(__file__), "matching_config.json")
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def calculate_match(self, cv_data: Dict, parsed_jd: Dict) -> Dict[str, Any]:
        """
        Calculates a multi-factor match score between CV and JD.
        """
        logger.info("⚡ Calculating intelligent match score...")
        
        # 1. Component Scoring
        cv_summary = cv_data.get("profile", {}).get("summary", "")
        jd_summary = parsed_jd.get("raw_text", "")
        semantic_score = self._embedder.compute_similarity(cv_summary[:1000], jd_summary[:1000])

        cv_skills_source = cv_data.get("skills", {}).get("items", [])
        cv_skills_list = [s.get("name", "") for s in cv_skills_source]
        jd_mandatory = parsed_jd.get("mandatory_skills", [])
        jd_bonus = parsed_jd.get("bonus_skills", [])
        
        skills_cv_text = ", ".join(cv_skills_list)
        skills_jd_text = ", ".join(jd_mandatory + jd_bonus)
        skills_score = self._embedder.compute_similarity(skills_cv_text, skills_jd_text)

        cv_domain = cv_data.get("analysis", {}).get("primary_domain")
        jd_domain = parsed_jd.get("primary_domain")
        
        domain_score = 1.0 if cv_domain == jd_domain else self._embedder.compute_similarity(cv_domain or "", jd_domain or "")
        if domain_score < self._config["thresholds"]["domain_cutoff"]:
            domain_score = 0.0

        # 2. Adaptive Weighted Base Score
        seniority = cv_data.get("analysis", {}).get("seniority", "junior").lower()
        weights = self._config["adaptive_weights"].get(seniority, self._config["adaptive_weights"]["default"])
        
        base_score = (
            (semantic_score * weights["semantic"]) +
            (skills_score * weights["skills"]) +
            (domain_score * weights["domain"])
        )

        # 3. Apply Hard Constraints (Score Collapse Logic)
        validation = self._validator.validate_constraints(cv_data, parsed_jd)
        
        # 4. Bonus Skill Boost
        bonus_boost = self._calculate_bonus_boost(cv_skills_list, jd_bonus)
        
        # Penalty reduction + Bonus boost
        final_score_raw = base_score - validation["total_penalty"] + bonus_boost
        final_score = max(0.0, min(1.0, final_score_raw))
        
        # 5. Fit Analysis (Professional Report)
        match_metadata = {
            "match_score": final_score * 100,
            "breakdown": {
                "base_ai_score": base_score * 100,
                "semantic_vibe": semantic_score * 100,
                "domain_alignment": domain_score * 100
            }
        }
        fit_report = self._analysis_gen.generate_report(match_metadata, validation, parsed_jd)

        return {
            "match_score": round(final_score * 100, 2),
            "is_qualified": final_score * 100 >= self._config["thresholds"]["min_pass_score"],
            "breakdown": {
                "base_ai_score": round(base_score * 100, 2),
                "semantic_vibe": round(semantic_score * 100, 2),
                "skills_similarity": round(skills_score * 100, 2),
                "domain_alignment": round(domain_score * 100, 2),
                "penalty_deduction": round(validation["total_penalty"] * 100, 2),
                "bonus_boost": round(bonus_boost * 100, 2)
            },
            "fit_analysis": fit_report,
            "missing_mandatory_skills": validation["missing_mandatory"]
        }

    def _calculate_bonus_boost(self, cv_skills: List[str], bonus_skills: List[str]) -> float:
        """
        Gives extra points for having bonus skills.
        Each bonus skill = +2%, Max boost = +10%.
        """
        if not bonus_skills:
            return 0.0
            
        cv_skills_lower = [s.lower() for s in cv_skills]
        matched_bonus = 0
        for bs in bonus_skills:
            if any(bs.lower() in cs or cs in bs.lower() for cs in cv_skills_lower):
                matched_bonus += 1
                
        return min(0.10, matched_bonus * 0.02)
