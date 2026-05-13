import logging
from typing import List, Dict, Any, Tuple

logger = logging.getLogger(__name__)

class ConstraintValidator:
    """
    Ensures that mandatory recruitment rules are met.
    Responsible for "Score Collapsing" if constraints are violated.
    """

    def validate_constraints(self, cv_data: Dict, parsed_jd: Dict) -> Dict[str, Any]:
        """
        Validates CV against JD constraints (Mandatory Skills, Experience, Seniority).
        Returns a penalty score and a list of violations.
        """
        violations = []
        penalty = 0.0
        
        # 1. Mandatory Skills Check
        missing_mandatory = self._check_mandatory_skills(cv_data, parsed_jd["mandatory_skills"])
        if missing_mandatory:
            violations.append(f"Missing mandatory skills: {', '.join(missing_mandatory)}")
            # Penalty: -15% for each missing mandatory skill, up to -50%
            penalty += min(0.5, len(missing_mandatory) * 0.15)

        # 2. Experience Years Check
        years_found = cv_data.get("analysis", {}).get("metadata", {}).get("experience", {}).get("total_experience_years", 0.0)
        years_required = parsed_jd.get("required_years_min", 0)
        
        if years_found < years_required:
            diff = years_required - years_found
            violations.append(f"Experience shortfall: has {years_found} years, requires {years_required} years.")
            # Penalty proportional to the gap
            penalty += min(0.3, (diff / years_required) * 0.5 if years_required > 0 else 0)

        # 3. Seniority Alignment Check
        cv_seniority = cv_data.get("analysis", {}).get("seniority", "junior").lower()
        jd_seniority = parsed_jd.get("seniority", "junior").lower()
        
        seniority_map = {"intern": 0, "junior": 1, "mid": 2, "senior": 3, "lead": 4, "principal": 5, "manager": 4}
        cv_val = seniority_map.get(cv_seniority, 1)
        jd_val = seniority_map.get(jd_seniority, 1)
        
        if cv_val < jd_val:
            violations.append(f"Seniority mismatch: Candidate is '{cv_seniority}', Role requires '{jd_seniority}'.")
            penalty += 0.2 # Flat 20% penalty for seniority mismatch

        return {
            "is_valid": len(violations) == 0,
            "violations": violations,
            "total_penalty": min(0.8, penalty), # Cap total penalty at 80%
            "missing_mandatory": missing_mandatory
        }

    def _check_mandatory_skills(self, cv_data: Dict, mandatory_skills: List[str]) -> List[str]:
        """
        Performs a deterministic check for mandatory skills.
        """
        cv_skills_source = cv_data.get("skills", {}).get("items", [])
        cv_skills = [s.get("name", "").lower() for s in cv_skills_source]
        
        missing = []
        for skill in mandatory_skills:
            skill_lower = skill.lower()
            # Simple substring match (e.g., "Python" in "Python Programming")
            # We will improve this with canonicalization later.
            found = any(skill_lower in s or s in skill_lower for s in cv_skills)
            if not found:
                missing.append(skill)
        
        return missing
