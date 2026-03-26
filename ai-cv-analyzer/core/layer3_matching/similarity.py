from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import numpy as np

from core.layer3_matching.embedder import SemanticEmbedder

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Seniority ordering — higher index == more senior
# ---------------------------------------------------------------------------
_SENIORITY_RANK: Dict[str, int] = {
    "intern": 0,
    "junior": 1,
    "mid": 2,
    "senior": 3,
    "lead": 4,
    "principal": 5,
}

_JD_SENIORITY_HINTS = re.compile(
    r"\b(intern|junior|graduate|entry.?level|mid.?level|mid|senior|sr\.|lead|principal|staff)\b",
    re.IGNORECASE,
)

_JD_DOMAIN_KEYWORDS: Dict[str, List[str]] = {
    "Backend Development": ["backend", "server-side", "api", "rest", "graphql", "node", "django", "laravel", "spring", "flask"],
    "Frontend Development": ["frontend", "ui", "ux", "react", "angular", "vue", "html", "css", "sass"],
    "Full Stack Development": ["fullstack", "full stack", "full-stack", "mern", "mean", "lamp"],
    "Mobile App Development": ["mobile", "ios", "android", "flutter", "react native", "swift", "kotlin"],
    "Data Science & AI": ["machine learning", "data science", "ml", "ai", "deep learning", "nlp", "llm", "pytorch", "tensorflow"],
    "DevOps & Cloud": ["devops", "cloud", "aws", "azure", "gcp", "kubernetes", "docker", "ci/cd", "terraform"],
    "UI/UX Design": ["ui/ux", "figma", "sketch", "design", "wireframe", "prototype"],
    "Quality Assurance & Testing": ["qa", "testing", "selenium", "playwright", "cypress", "automation"],
    "Product Management": ["product manager", "product owner", "roadmap", "agile", "scrum", "kanban"],
    "Cybersecurity": ["security", "penetration", "pentest", "vulnerability", "siem", "firewall"],
}


@dataclass
class MatchResult:
    match_score: float                  # 0-100 composite
    semantic_score: float               # 0-100
    skill_alignment_score: float        # 0-100
    domain_seniority_score: float       # 0-100
    missing_skills: List[str] = field(default_factory=list)
    red_flags: List[str] = field(default_factory=list)
    jd_detected_domain: Optional[str] = None
    jd_detected_seniority: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "match_score": round(self.match_score, 2),
            "component_scores": {
                "semantic": round(self.semantic_score, 2),
                "skill_alignment": round(self.skill_alignment_score, 2),
                "domain_seniority_fit": round(self.domain_seniority_score, 2),
            },
            "missing_skills": self.missing_skills,
            "red_flags": self.red_flags,
            "jd_detected_domain": self.jd_detected_domain,
            "jd_detected_seniority": self.jd_detected_seniority,
        }


class IntelligentMatcher:
    """
    Layer 3: Hybrid Matching Engine.

    Calculates a weighted match score between a CV and a Job Description.

    Weights:
      40% - Semantic similarity  (CV full text vs JD description)
      40% - Skill alignment      (JD required skills ∩ CV extracted skills)
      20% - Domain/seniority fit (CV primary_domain & seniority vs JD hints)

    Singleton: the embedding model is expensive to load — only one instance
    is ever created per process.
    """

    _instance: Optional["IntelligentMatcher"] = None

    def __new__(cls) -> "IntelligentMatcher":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._embedder = SemanticEmbedder()
            logger.info("IntelligentMatcher singleton created.")
        return cls._instance

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def calculate_match(
        self,
        cv_result: Any,                 # CVParseResult (avoid circular import)
        job_data: Dict[str, Any],
        cv_raw_text: str = "",
    ) -> MatchResult:
        """
        Hybrid matching using structured CV data.

        Parameters
        ----------
        cv_result   : CVParseResult from the orchestrator.
        job_data    : Dict with keys:
                      - "title"           (str, optional)
                      - "description"     (str)          — JD full text
                      - "required_skills" (List[str])    — explicit skill list
                      - "seniority_level" (str, optional)— e.g. "senior"
                      - "domain"          (str, optional)— e.g. "Backend Development"
        cv_raw_text : The spatial ordered_text from the CV PDF (for embedding).
        """
        jd_title = job_data.get("title", "Unknown")
        logger.info("IntelligentMatcher: evaluating against JD '%s'", jd_title)

        jd_description: str = job_data.get("description", "")
        jd_skills: List[str] = job_data.get("required_skills", [])

        # Extract CV structured data
        cv_skill_names: List[str] = [sk.name for sk in cv_result.skills.items]
        cv_domain: Optional[str] = cv_result.analysis.primary_domain
        cv_seniority: Optional[str] = cv_result.analysis.seniority

        # ── 1. Semantic score (40%) ──────────────────────────────────────────
        semantic_score = self._semantic_score(cv_raw_text, jd_description)

        # ── 2. Skill alignment score (40%) ──────────────────────────────────
        skill_score, missing_skills = self._skill_alignment(cv_skill_names, jd_skills)

        # ── 3. Domain & seniority fit (20%) ─────────────────────────────────
        jd_domain = job_data.get("domain") or _detect_jd_domain(jd_description)
        jd_seniority = job_data.get("seniority_level") or _detect_jd_seniority(jd_description)
        domain_sen_score, red_flags = self._domain_seniority_fit(
            cv_domain, cv_seniority, jd_domain, jd_seniority
        )

        # ── Composite score ─────────────────────────────────────────────────
        composite = (
            semantic_score * 0.40
            + skill_score * 0.40
            + domain_sen_score * 0.20
        )

        return MatchResult(
            match_score=round(min(100.0, composite), 2),
            semantic_score=round(semantic_score, 2),
            skill_alignment_score=round(skill_score, 2),
            domain_seniority_score=round(domain_sen_score, 2),
            missing_skills=missing_skills,
            red_flags=red_flags,
            jd_detected_domain=jd_domain,
            jd_detected_seniority=jd_seniority,
        )

    # ------------------------------------------------------------------
    # Legacy API (backward compat for /api/v2/match-job)
    # ------------------------------------------------------------------

    def calculate_match_legacy(
        self, cv_data: Dict[str, Any], job_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Original dict-based matching kept for the /api/v2/match-job route."""
        logger.info("IntelligentMatcher (legacy): job=%s", job_data.get("title", "Unknown"))

        cv_vec = self._embedder.get_embedding(cv_data.get("raw_text", ""))
        job_vec = self._embedder.get_embedding(job_data.get("description", ""))
        sem = self._cosine_similarity(cv_vec, job_vec) * 100.0

        cv_skills = cv_data.get("skills", [])
        job_skills = job_data.get("skills", [])
        overlap, missing = self._skill_alignment(cv_skills, job_skills)

        final = (sem * 0.6) + (overlap * 0.4)
        return {
            "match_score": round(final, 2),
            "semantic_score": round(sem, 2),
            "skill_overlap_score": round(overlap, 2),
            "missing_skills": missing,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _semantic_score(self, cv_text: str, jd_text: str) -> float:
        """Returns cosine similarity scaled to 0-100."""
        cv_vec = self._embedder.get_embedding(cv_text[:3000] if cv_text else "")
        jd_vec = self._embedder.get_embedding(jd_text[:3000] if jd_text else "")
        return self._cosine_similarity(cv_vec, jd_vec) * 100.0

    def _skill_alignment(
        self, cv_skills: List[str], jd_skills: List[str]
    ) -> tuple[float, List[str]]:
        """
        Returns (score_0_to_100, missing_skills_list).
        Score = intersection / |JD skills| × 100.
        """
        if not jd_skills:
            return 100.0, []
        if not cv_skills:
            return 0.0, list(jd_skills)

        cv_lower = {s.lower() for s in cv_skills}
        missing = [s for s in jd_skills if s.lower() not in cv_lower]
        overlap_ratio = 1.0 - (len(missing) / len(jd_skills))
        return round(overlap_ratio * 100.0, 2), missing

    def _domain_seniority_fit(
        self,
        cv_domain: Optional[str],
        cv_seniority: Optional[str],
        jd_domain: Optional[str],
        jd_seniority: Optional[str],
    ) -> tuple[float, List[str]]:
        """
        Returns (score_0_to_100, red_flags).

        Domain match contributes 60 points; seniority fit contributes 40 points.
        """
        red_flags: List[str] = []
        score = 0.0

        # Domain (60 pts)
        if jd_domain and cv_domain:
            if jd_domain.lower() == cv_domain.lower():
                score += 60.0
            else:
                score += 20.0  # partial credit for different but related domains
        else:
            score += 30.0  # unknown — give neutral half credit

        # Seniority (40 pts)
        cv_rank = _SENIORITY_RANK.get(cv_seniority or "", -1)
        jd_rank = _SENIORITY_RANK.get(jd_seniority or "", -1)

        if cv_rank == -1 or jd_rank == -1:
            score += 20.0  # unknown — neutral
        else:
            diff = jd_rank - cv_rank
            if diff == 0:
                score += 40.0
            elif abs(diff) == 1:
                score += 25.0
                if diff > 0:
                    red_flags.append(
                        f"Seniority gap: JD requires '{jd_seniority}' but CV is '{cv_seniority}'."
                    )
                else:
                    red_flags.append(
                        f"Possible overqualification: CV is '{cv_seniority}' but JD targets '{jd_seniority}'."
                    )
            else:
                score += 5.0
                if diff > 0:
                    red_flags.append(
                        f"Major seniority mismatch: JD requires '{jd_seniority}' but CV is '{cv_seniority}'."
                    )
                else:
                    red_flags.append(
                        f"Significant overqualification: CV is '{cv_seniority}' but JD targets '{jd_seniority}'."
                    )

        return min(100.0, score), red_flags

    @staticmethod
    def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
        if np.all(a == 0) or np.all(b == 0):
            return 0.0
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------

def _detect_jd_domain(text: str) -> Optional[str]:
    """Heuristic: count domain keyword hits in the JD text."""
    if not text:
        return None
    lower = text.lower()
    scores: Dict[str, int] = {}
    for domain, keywords in _JD_DOMAIN_KEYWORDS.items():
        scores[domain] = sum(1 for kw in keywords if kw in lower)
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else None


def _detect_jd_seniority(text: str) -> Optional[str]:
    """Extract the first seniority hint from the JD text."""
    if not text:
        return None
    m = _JD_SENIORITY_HINTS.search(text)
    if not m:
        return None
    token = m.group(1).lower().strip(".")
    _MAP = {
        "intern": "intern",
        "junior": "junior",
        "graduate": "junior",
        "entry-level": "junior",
        "entrylevel": "junior",
        "mid-level": "mid",
        "midlevel": "mid",
        "mid": "mid",
        "senior": "senior",
        "sr.": "senior",
        "lead": "lead",
        "principal": "principal",
        "staff": "principal",
    }
    return _MAP.get(token)
