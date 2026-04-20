import logging
from typing import Dict, List
import numpy as np
try:
    from rapidfuzz import fuzz
    RAPIDFUZZ_AVAILABLE = True
except ImportError:
    RAPIDFUZZ_AVAILABLE = False

from core.layer3_matching.embedder import SemanticEmbedder
from core.layer2_classification.classifier import CVDomainClassifier

logger = logging.getLogger(__name__)

class IntelligentMatcher:
    """
    Layer 3: Intelligent Matching Engine
    Calculates the semantic match between a CV and a Job Description.
    """
    # Adaptive weights based on candidate seniority
    # This makes matching fairer for juniors and stricter for seniors.
    ADAPTIVE_WEIGHTS = {
        "intern": {"semantic": 0.30, "skills_structured": 0.60, "domain": 0.10},
        "junior": {"semantic": 0.40, "skills_structured": 0.40, "domain": 0.20},
        "senior": {"semantic": 0.30, "skills_structured": 0.20, "domain": 0.50}, # Domain expertise is key
        "lead":   {"semantic": 0.20, "skills_structured": 0.20, "domain": 0.60},
        "default": {"semantic": 0.40, "skills_structured": 0.40, "domain": 0.20}
    }

    def __init__(self):
        self.embedder = SemanticEmbedder()
        self._classifier = CVDomainClassifier()

    def _cosine_similarity(self, vec_a: np.ndarray, vec_b: np.ndarray) -> float:
        """Calculate cosine similarity between two vectors."""
        if np.all(vec_a == 0) or np.all(vec_b == 0):
            return 0.0
            
        dot_product = np.dot(vec_a, vec_b)
        norm_a = np.linalg.norm(vec_a)
        norm_b = np.linalg.norm(vec_b)
        
        return float(dot_product / (norm_a * norm_b))

    def _calculate_skill_overlap(self, cv_skills: List[str], job_skills: List[str]) -> float:
        """Calculate the exact/fuzzy overlap ratio of skills."""
        if not job_skills:
            return 1.0  # No skills required
        if not cv_skills:
            return 0.0

        cv_skills_lower = [s.lower() for s in cv_skills]
        matched_count = 0

        for job_skill in job_skills:
            js_lower = job_skill.lower()
            
            # Level 1: Exact Match
            if js_lower in cv_skills_lower:
                matched_count += 1
                continue
            
            # Level 2: Fuzzy Match (RapidFuzz)
            if RAPIDFUZZ_AVAILABLE:
                best_ratio = 0
                for cs_lower in cv_skills_lower:
                    ratio = fuzz.ratio(js_lower, cs_lower)
                    if ratio > best_ratio:
                        best_ratio = ratio
                
                if best_ratio >= 80: # Threshold for considering it a match
                    matched_count += 1
                    continue
        
        return matched_count / len(job_skills)

    def calculate_match(self, cv_data: Dict, job_data: Dict) -> Dict:
        """
        Calculates a holistic match score based on semantics and hard skills.
        
        cv_data format: {"raw_text": "...", "skills": ["Python", ...]}
        job_data format: {"description": "...", "skills": ["Python", ...]}
        """
        logger.info(f"Calculating match for job: {job_data.get('title', 'Unknown')}")
        
        # Extract core data from structured CV output
        cv_raw_text = cv_data.get("raw_text")
        if not cv_raw_text:
            cv_raw_text = cv_data.get("analysis", {}).get("metadata", {}).get("extraction", {}).get("raw_text", "")
        
        cv_skills_source = cv_data.get("skills", [])
        if isinstance(cv_skills_source, dict) and "items" in cv_skills_source:
             cv_skills = [s.get("name", "") for s in cv_skills_source.get("items", []) if s.get("name")]
        else:
             cv_skills = cv_skills_source if isinstance(cv_skills_source, list) else []

        job_skills = job_data.get("skills", [])

        # 1. Structured Comparison: Skills ↔ Job Skills (Crucial Addition)
        # We match the CV's canonical skills directly against the Job's required skills
        cv_skills_text = ", ".join(cv_skills)
        job_skills_text = ", ".join(job_skills)
        
        skills_vec_cv = self.embedder.get_embedding(cv_skills_text)
        skills_vec_job = self.embedder.get_embedding(job_skills_text)
        skills_semantic_score = self._cosine_similarity(skills_vec_cv, skills_vec_job)

        # 2. Contextual Comparison: Summary/Experience ↔ Job Description
        # Fix: Look for experience/summary to avoid full-text dilution
        cv_context_text = cv_data.get("profile", {}).get("summary", "")
        if not cv_context_text:
             cv_context_text = cv_raw_text[:2000] # Fallback to first 2000 chars

        cv_context_vec = self.embedder.get_embedding(cv_context_text)
        job_desc_vec = self.embedder.get_embedding(job_data.get("description", ""))
        contextual_score = self._cosine_similarity(cv_context_vec, job_desc_vec)

        # 3. Domain Match Score (Layer 2 Integration)
        cv_domain = cv_data.get("analysis", {}).get("primary_domain")
        if not cv_domain and "primary_domain" in cv_data:
            cv_domain = cv_data["primary_domain"]
        
        job_domain = job_data.get("primary_domain")
        if not job_domain and job_data.get("description"):
            job_domain_results = self._classifier.predict_domain(job_data["description"][:1500])
            if job_domain_results:
                job_domain = max(job_domain_results, key=job_domain_results.get)
        
        domain_match_score = 0.0
        if cv_domain and job_domain:
            if cv_domain == job_domain:
                domain_match_score = 1.0
            else:
                cv_domain_vec = self.embedder.get_embedding(cv_domain)
                job_domain_vec = self.embedder.get_embedding(job_domain)
                domain_match_score = self._cosine_similarity(cv_domain_vec, job_domain_vec)
                if domain_match_score < 0.65: # Threshold for unrelated domains
                    domain_match_score = 0.0
        else:
            domain_match_score = 0.5 

        # 4. Adaptive Weighting Logic
        # Select weights based on detected seniority from Layer 1
        seniority = cv_data.get("analysis", {}).get("seniority", "junior").lower()
        weights = self.ADAPTIVE_WEIGHTS.get(seniority, self.ADAPTIVE_WEIGHTS["default"])
        
        # Combine segmented scores
        final_score = (
            (contextual_score * weights["semantic"]) +
            (skills_semantic_score * weights["skills_structured"]) +
            (domain_match_score * weights["domain"])
        )
        
        # Calculate missing essential skills (Fuzzy)
        missing_skills = []
        cv_skills_lower = [s.lower() for s in cv_skills]
        for js in job_skills:
            js_lower = js.lower()
            found = False
            if js_lower in cv_skills_lower:
                found = True
            elif RAPIDFUZZ_AVAILABLE:
                for cs_lower in cv_skills_lower:
                    if fuzz.ratio(js_lower, cs_lower) >= 80:
                        found = True
                        break
            if not found:
                missing_skills.append(js)
        
        return {
            "match_score": round(final_score * 100, 2),
            "breakdown": {
                "contextual_similarity": round(contextual_score * 100, 2),
                "structured_skills_similarity": round(skills_semantic_score * 100, 2),
                "domain_alignment": round(domain_match_score * 100, 2)
            },
            "weights_used": weights,
            "missing_skills": missing_skills,
            "detected_domains": {"cv": cv_domain, "job": job_domain}
        }
