import logging
import re
from typing import List, Dict, Any, Optional
from core.layer2_classification.domain_engine import DomainEngine
from core.layer2_classification.seniority_engine import SeniorityEngine

logger = logging.getLogger(__name__)

class JobDescriptionEngine:
    """
    Phase 1: JD Parser Engine.
    Extracts structured data (Skills, Experience, Seniority) from raw job description text.
    """

    def __init__(self, domain_engine: DomainEngine, seniority_engine: SeniorityEngine):
        self._domain_engine = domain_engine
        self._seniority_engine = seniority_engine

    def parse_jd(self, jd_text: str) -> Dict[str, Any]:
        """
        Main entry point to convert raw JD text into a structured object.
        """
        logger.info("🧠 Parsing raw Job Description text...")
        
        # 1. Basic Cleaning
        clean_text = jd_text.strip()
        
        # 2. Extract Seniority & Required Years
        seniority_info = self._extract_seniority_and_years(clean_text)
        
        # 3. Extract Skills (Mandatory vs Bonus)
        skills_info = self._extract_skills(clean_text)
        
        # 4. Predict Primary Domain
        domain_scores = self._domain_engine.predict_domain({"profile": {"summary": clean_text}})
        primary_domain = max(domain_scores, key=domain_scores.get) if domain_scores else None

        return {
            "raw_text": clean_text,
            "primary_domain": primary_domain,
            "seniority": seniority_info["level"],
            "required_years_min": seniority_info["min_years"],
            "required_years_max": seniority_info["max_years"],
            "mandatory_skills": skills_info["mandatory"],
            "bonus_skills": skills_info["bonus"],
            "domain_scores": domain_scores
        }

    def _extract_seniority_and_years(self, text: str) -> Dict[str, Any]:
        """
        Uses regex and keyword analysis to find required years of experience.
        """
        years_min = 0
        years_max = 0
        
        # Look for patterns like "3+ years", "3-5 years", "0-2 years"
        patterns = [
            r"(\d+)\s*-\s*(\d+)\s*years?",
            r"(\d+)\s*to\s*(\d+)\s*years?",
            r"(\d+)\s*\+?\s*years?",
            r"min(?:imum)?\s*(\d+)\s*years?"
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                groups = match.groups()
                if len(groups) == 2 and groups[0] and groups[1]:
                    years_min = int(groups[0])
                    years_max = int(groups[1])
                elif groups[0]:
                    years_min = int(groups[0])
                    years_max = years_min + 2
                break

        # Improved Seniority Detection: Look for explicit keywords in the first lines
        first_lines = text.lower().split('\n')[:3]
        detected_level = "junior" # Default
        for line in first_lines:
            if "senior" in line: detected_level = "senior"
            elif "lead" in line: detected_level = "lead"
            elif "intern" in line: detected_level = "intern"
            elif "junior" in line: detected_level = "junior"
            elif "mid" in line: detected_level = "mid"

        return {
            "level": detected_level,
            "min_years": years_min,
            "max_years": years_max
        }

    def _extract_skills(self, text: str) -> Dict[str, List[str]]:
        """
        Splits JD into sections and lines to distinguish between Required and Nice-to-have.
        """
        mandatory = []
        bonus = []
        
        # 1. Split into sections only when keywords act as headers (e.g., "Requirements:" or start of line)
        # Using a more specific regex that looks for keywords followed by optional colon and newline/space
        header_pattern = r"\n\s*(Requirements|Qualifications|Required Skills|Nice to have|Preferred|Bonus|Optional|Responsibilities)[:\s]*\n?"
        sections = re.split(header_pattern, "\n" + text, flags=re.IGNORECASE)
        
        # The first element is text before any header
        if sections[0].strip():
            mandatory.extend(self._heuristic_skill_extraction(sections[0]))

        for i in range(1, len(sections), 2):
            header = sections[i].lower()
            content = sections[i+1] if i+1 < len(sections) else ""
            
            if any(kw in header for kw in ["nice to have", "preferred", "bonus", "optional"]):
                section_category = "bonus"
            else:
                section_category = "mandatory"
                
            # 2. Extract lines and check for local "bonus" keywords
            lines = content.split('\n')
            for line in lines:
                line_content = self._heuristic_skill_extraction_single_line(line)
                if not line_content: continue
                
                # If the line itself mentions "bonus" or "nice to have", it's a bonus
                if any(kw in line.lower() for kw in ["bonus", "optional", "nice to have", "preferred"]):
                    bonus.append(line_content)
                else:
                    if section_category == "mandatory":
                        mandatory.append(line_content)
                    else:
                        bonus.append(line_content)
        
        # If no sections were found, try extracting everything as mandatory
        if not mandatory and not bonus:
            mandatory = self._heuristic_skill_extraction(text)

        return {
            "mandatory": list(set(mandatory)),
            "bonus": list(set(bonus))
        }

    def _heuristic_skill_extraction_single_line(self, line: str) -> Optional[str]:
        """Checks a single line for a skill and returns it cleaned."""
        line = line.strip()
        if re.search(r"\d+[-+]\s*years", line, re.IGNORECASE) or "experience" in line.lower():
            return None
            
        if line.startswith(('•', '-', '*', '1.', '2.')):
            content = re.sub(r"^[•\-\*\d\.]+\s*", "", line).strip()
            # Remove "is a bonus", "is preferred" etc from the skill name itself
            skill_name = re.sub(r"\s*(is a bonus|is preferred|nice to have|optional|is a plus).*$", "", content, flags=re.IGNORECASE).strip()
            
            if len(skill_name.split()) <= 7:
                return skill_name
            else:
                # Fallback to keyword matching for long lines
                tech_keywords = ["PHP", "Laravel", "MySQL", "API", "Flutter", "React", "Python", "Java", "Docker"]
                for kw in tech_keywords:
                    if kw.lower() in skill_name.lower():
                        return kw
        return None

    def _heuristic_skill_extraction(self, text: str) -> List[str]:
        """
        Extracts potential skill-like tokens.
        """
        skills = []
        lines = text.split('\n')
        for line in lines:
            skill = self._heuristic_skill_extraction_single_line(line)
            if skill:
                skills.append(skill)
        
        return list(set(skills))
