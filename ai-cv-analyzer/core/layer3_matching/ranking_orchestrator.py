import logging
from typing import List, Dict, Any
from core.layer3_matching.similarity import IntelligentMatcher
from core.layer3_matching.job_description_engine import JobDescriptionEngine

logger = logging.getLogger(__name__)

class RankingOrchestrator:
    """
    Phase 4: Multi-Candidate Ranking Pipeline.
    Ranks a list of CVs against a single Job Description.
    """

    def __init__(self, matcher: IntelligentMatcher, jd_engine: JobDescriptionEngine):
        self._matcher = matcher
        self._jd_engine = jd_engine

    def rank_candidates(self, cv_results: List[Dict[str, Any]], jd_text: str) -> Dict[str, Any]:
        """
        Takes a list of pre-processed CV results and ranks them against a raw JD.
        """
        logger.info(f"📊 Ranking {len(cv_results)} candidates against JD...")
        
        # 1. Parse JD once
        parsed_jd = self._jd_engine.parse_jd(jd_text)
        
        # 2. Match each candidate
        ranked_list = []
        for cv in cv_results:
            match_result = self._matcher.calculate_match(cv, parsed_jd)
            
            # Combine basic info for the summary
            ranked_list.append({
                "candidate_name": cv.get("profile", {}).get("full_name", "Unknown"),
                "match_score": match_result["match_score"],
                "verdict": match_result["fit_analysis"]["verdict"],
                "primary_domain": cv.get("analysis", {}).get("primary_domain"),
                "seniority": cv.get("analysis", {}).get("seniority"),
                "full_match_details": match_result
            })
            
        # 3. Sort by match score descending
        ranked_list.sort(key=lambda x: x["match_score"], reverse=True)
        
        # 4. Generate Shortlist (Top candidates with score > pass threshold)
        pass_threshold = self._matcher._config["thresholds"]["min_pass_score"]
        shortlist = [c for c in ranked_list if c["match_score"] >= pass_threshold]

        return {
            "job_info": {
                "title": parsed_jd.get("seniority", "") + " " + parsed_jd.get("primary_domain", ""),
                "required_years": parsed_jd.get("required_years_min")
            },
            "total_candidates": len(cv_results),
            "shortlisted_count": len(shortlist),
            "rankings": ranked_list
        }
