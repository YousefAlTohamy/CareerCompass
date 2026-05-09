import logging
from typing import Dict, List, Any

logger = logging.getLogger(__name__)

class FitAnalysisGenerator:
    """
    Generates professional, human-readable recruitment insights.
    Translates mathematical scores into business value.
    """

    def generate_report(self, 
                        match_result: Dict[str, Any], 
                        validation_results: Dict[str, Any],
                        parsed_jd: Dict[str, Any]) -> Dict[str, Any]:
        """
        Builds a comprehensive Fit Analysis report.
        """
        score = match_result.get("match_score", 0.0)
        
        strengths = self._identify_strengths(match_result, validation_results, parsed_jd)
        gaps = self._identify_gaps(validation_results, parsed_jd)
        red_flags = self._identify_red_flags(match_result, validation_results)
        
        # Final Verdict based on score and red flags
        if score >= 85 and not red_flags:
            verdict = "Top Talent - High priority for interview."
        elif score >= 70:
            verdict = "Strong Match - Qualified for the role."
        elif score >= 50:
            verdict = "Potential Fit - Worth considering despite some gaps."
        else:
            verdict = "Not Recommended - Does not meet core requirements."

        return {
            "verdict": verdict,
            "summary": self._generate_summary(score, verdict),
            "strengths": strengths,
            "gaps": gaps,
            "red_flags": red_flags,
            "bonus_points": self._calculate_bonus_highlights(match_result, parsed_jd)
        }

    def _generate_summary(self, score: float, verdict: str) -> str:
        return f"Candidate matched {score}% of the requirements. {verdict}"

    def _identify_strengths(self, match_result: Dict, validation: Dict, jd: Dict) -> List[str]:
        strengths = []
        if match_result["breakdown"]["domain_alignment"] > 90:
            strengths.append(f"Excellent domain expertise in {jd['primary_domain']}.")
        
        if not validation["missing_mandatory"]:
            strengths.append("Possesses all mandatory technical requirements.")
            
        if match_result["breakdown"]["semantic_vibe"] > 80:
            strengths.append("High contextual alignment with the job responsibilities.")
            
        return strengths

    def _identify_gaps(self, validation: Dict, jd: Dict) -> List[str]:
        gaps = []
        for v in validation["violations"]:
            if "Experience shortfall" in v:
                gaps.append(v)
            if "Missing mandatory skills" in v:
                gaps.append(v)
        return gaps

    def _identify_red_flags(self, match_result: Dict, validation: Dict) -> List[str]:
        flags = []
        # Red flag if score is high but seniority is totally wrong
        if any("Seniority mismatch" in v for v in validation["violations"]):
            flags.append("Significant seniority level mismatch.")
            
        # Red flag if domain is completely different
        if match_result["breakdown"]["domain_alignment"] < 40:
            flags.append("Career domain does not align with industry requirements.")
            
        return flags

    def _calculate_bonus_highlights(self, match_result: Dict, jd: Dict) -> List[str]:
        # Logic to see if any bonus skills from JD are present in CV
        # For now, placeholder for Phase 4 enhancements
        return []
