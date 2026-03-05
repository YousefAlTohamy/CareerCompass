import logging
from typing import Dict, List
import numpy as np
from core.layer3_matching.embedder import SemanticEmbedder

logger = logging.getLogger(__name__)

class IntelligentMatcher:
    """
    Layer 3: Intelligent Matching Engine
    Calculates the semantic match between a CV and a Job Description.
    """
    def __init__(self):
        self.embedder = SemanticEmbedder()

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
            return 1.0 # No skills required
        if not cv_skills:
            return 0.0
            
        cv_skills_lower = set([s.lower() for s in cv_skills])
        job_skills_lower = set([s.lower() for s in job_skills])
        
        intersection = cv_skills_lower.intersection(job_skills_lower)
        return len(intersection) / len(job_skills_lower)

    def calculate_match(self, cv_data: Dict, job_data: Dict) -> Dict:
        """
        Calculates a holistic match score based on semantics and hard skills.
        
        cv_data format: {"raw_text": "...", "skills": ["Python", ...]}
        job_data format: {"description": "...", "skills": ["Python", ...]}
        """
        logger.info(f"Calculating match for job: {job_data.get('title', 'Unknown')}")
        
        # 1. Semantic Score (The ML Part)
        # We compare the CV's full text to the Job's description
        cv_vec = self.embedder.get_embedding(cv_data.get("raw_text", ""))
        job_vec = self.embedder.get_embedding(job_data.get("description", ""))
        
        semantic_score = self._cosine_similarity(cv_vec, job_vec)
        
        # 2. Skill Overlap Score (The Hard Requirements)
        cv_skills = cv_data.get("skills", [])
        job_skills = job_data.get("skills", [])
        overlap_score = self._calculate_skill_overlap(cv_skills, job_skills)
        
        # 3. Final Composite Score
        # Weightings: 60% Meaning (Semantic), 40% Exact Skills
        final_score = (semantic_score * 0.6) + (overlap_score * 0.4)
        
        # Calculate missing essential skills
        cv_skills_lower = set([s.lower() for s in cv_skills])
        missing_skills = [s for s in job_skills if s.lower() not in cv_skills_lower]
        
        return {
            "match_score": round(final_score * 100, 2),
            "semantic_score": round(semantic_score * 100, 2),
            "skill_overlap_score": round(overlap_score * 100, 2),
            "missing_skills": missing_skills
        }
