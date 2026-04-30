"""
ai/ner_extractor.py
====================
Phase 4 — Custom Skill Extraction & Title Validation Engine

Implements a hybrid skill extraction strategy that works reliably **without**
any ML model, but optionally leverages spaCy's Entity Ruler when available.

Also provides a title extraction & validation layer that:
- Defines a refined system prompt for LLM-based title extraction
- Validates extracted titles against negative patterns (search metadata,
  job counts, platform names) to prevent garbage data from passing through
- Flags invalid titles for Dead Letter Queue (DLQ) routing

Extraction layers (in order of priority)
-----------------------------------------
1. **Compound-phrase lexicon** — multi-word skills ("machine learning",
   "node.js", "rest api") are matched first using longest-match-first
   scanning.  This prevents "react" from matching "react native" as two
   separate skills.

2. **Single-word lexicon** — individual technology keywords matched as
   whole words (regex ``\\b`` boundaries).

3. **spaCy Entity Ruler** (optional) — if spaCy + a language model is
   installed, a custom entity ruler with ``SKILL`` patterns is added to
   the pipeline.  The ruler runs *before* the default NER, so our custom
   entities take precedence over the model's guesses.  If spaCy is not
   installed, this layer is silently skipped.

Design rationale
----------------
Using both a custom lexicon AND spaCy's ruler gives us:
* **Recall** on known skills (lexicon never misses them)
* **Precision** on novel phrasing (spaCy's context window helps)
* **Graceful degradation** — the extractor works even with no spaCy install

CS Concept: Trie / Longest-Match
---------------------------------
Multi-word skills are scanned left-to-right.  At each token position we
greedily attempt the longest phrase match before falling back to shorter
ones.  This is equivalent to a prefix trie traversal in O(L) per position
where L is the max phrase length.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

from ai.canonicalizer import SkillCanonicalizer

# ---------------------------------------------------------------------------
# Master skill lexicon
# Organised by category; all entries are lowercase.
# Multi-word entries are matched with longest-match-first priority.
# ---------------------------------------------------------------------------
_SKILL_LEXICON: dict[str, list[str]] = {
    "languages": [
        "python", "java", "javascript", "typescript", "c++", "c#", "c",
        "go", "golang", "rust", "swift", "kotlin", "scala", "r", "ruby",
        "php", "perl", "dart", "elixir", "haskell", "lua", "matlab",
        "objective-c", "shell", "bash", "powershell", "sql", "nosql",
    ],
    "web_frameworks": [
        "django", "flask", "fastapi", "starlette",
        "react", "react.js", "reactjs", "react native",
        "vue", "vue.js", "vuejs", "angular", "angularjs",
        "next.js", "nextjs", "nuxt.js", "nuxtjs",
        "node.js", "nodejs", "express", "express.js",
        "spring", "spring boot", "laravel", "rails", "ruby on rails",
        "asp.net", "asp.net core", ".net", "dotnet",
        "svelte", "gatsby", "remix",
    ],
    "databases": [
        "postgresql", "postgres", "mysql", "mariadb", "sqlite",
        "mongodb", "redis", "cassandra", "dynamodb", "firebase",
        "elasticsearch", "neo4j", "couchdb", "oracle", "sql server",
        "microsoft sql server", "bigquery",
    ],
    "cloud_devops": [
        "aws", "amazon web services", "gcp", "google cloud",
        "azure", "microsoft azure",
        "docker", "kubernetes", "k8s", "terraform", "ansible",
        "ci/cd", "jenkins", "github actions", "gitlab ci",
        "linux", "unix", "nginx", "apache", "kafka", "rabbitmq",
        "helm", "prometheus", "grafana", "datadog",
    ],
    "ai_ml": [
        "machine learning", "deep learning", "neural networks",
        "natural language processing", "nlp", "computer vision",
        "tensorflow", "pytorch", "keras", "scikit-learn", "sklearn",
        "pandas", "numpy", "scipy", "matplotlib", "seaborn",
        "hugging face", "transformers", "bert", "gpt",
        "reinforcement learning", "data science", "feature engineering",
        "xgboost", "lightgbm", "random forest",
    ],
    "methodologies": [
        "rest", "rest api", "restful", "graphql", "grpc",
        "microservices", "agile", "scrum", "kanban", "tdd",
        "bdd", "ci/cd", "devops", "mlops", "oop",
        "design patterns", "solid principles",
    ],
    "tools": [
        "git", "github", "gitlab", "bitbucket",
        "jira", "confluence", "slack", "figma",
        "postman", "swagger", "openapi",
        "celery", "airflow", "spark", "hadoop",
        "jupyter", "vscode", "intellij",
    ],
}

# Flatten to sorted list — multi-word skills first (longest match priority)
_FLAT_SKILLS: list[str] = sorted(
    {skill for skills in _SKILL_LEXICON.values() for skill in skills},
    key=lambda s: (-len(s), s),   # sort: longer phrases first
)

# Pre-compile whole-word matchers for every skill
_SKILL_PATTERNS: list[tuple[str, re.Pattern]] = [
    (
        skill,
        re.compile(
            r"(?<![a-zA-Z0-9_-])" + re.escape(skill) + r"(?![a-zA-Z0-9_-])",
            re.IGNORECASE,
        ),
    )
    for skill in _FLAT_SKILLS
]


# ---------------------------------------------------------------------------
# Title Extraction — LLM System Prompt & Validation
# ---------------------------------------------------------------------------

TITLE_EXTRACTION_SYSTEM_PROMPT: str = """You are a precision job-title extraction engine.

Your ONLY task is to extract the professional job title from the provided
text. Follow these rules strictly:

1. Extract ONLY the professional job title (e.g. "Senior Software Engineer",
   "Data Analyst", "Product Manager"). Return the title and nothing else.

2. DISCARD all of the following if present in the input:
   - Search metadata: result counts ("4,178,000+ jobs"), pagination
     ("Showing 1-25 of 500"), "Results for ..."
   - Platform names: "LinkedIn", "Indeed", "Glassdoor", "ZipRecruiter"
   - Location information: city names, countries, "in New York",
     "United States"
   - Job count phrases: "500+ results", "Browse jobs"
   - Salary information: "$80k-$100k", "EGP 10,000"
   - Noise labels: "New!", "Hot", "Featured", "Apply now", "Easy Apply"
   - Freshness tags: "3d ago", "Posted today", "Just posted"

3. If the input contains NO identifiable professional job title (i.e. it
   is entirely search metadata, navigation text, or noise), return exactly
   the string: "Unknown"

4. Do NOT invent or guess a title. If uncertain, return "Unknown".

5. The output must be 1-8 words maximum. Do not include explanations,
   punctuation beyond what's in the title, or surrounding text.

Examples:
  Input: "4,178,000+ jobs in United States"  →  Output: "Unknown"
  Input: "Senior Python Developer - New York | LinkedIn"  →  Output: "Senior Python Developer"
  Input: "Showing 1-25 of 500 results for software engineer"  →  Output: "Software Engineer"
  Input: "Staff Machine Learning Engineer"  →  Output: "Staff Machine Learning Engineer"
  Input: "Apply now: Data Analyst · 3d ago"  →  Output: "Data Analyst"
"""

# Values that indicate the AI extraction failed to find a real title
_INVALID_TITLE_SENTINELS: frozenset[str] = frozenset({
    "unknown", "n/a", "none", "null", "not found", "not available",
    "no title", "untitled", "undefined", "", "error",
})

# Regex patterns that indicate the "title" is still search metadata
_TITLE_REJECTION_PATTERNS: list[re.Pattern[str]] = [
    # Job count strings: "4,178,000+ jobs", "500 results"
    re.compile(
        r"\d{1,3}(?:,\d{3})*\+?\s*(?:jobs?|results?|positions?|openings?|vacancies)",
        re.IGNORECASE,
    ),
    # Pagination: "Showing 1-25", "Page 1 of 50"
    re.compile(r"\bshowing\s+\d+\s*[-–—]\s*\d+", re.IGNORECASE),
    re.compile(r"\bpage\s+\d+\s+of\s+\d+", re.IGNORECASE),
    # "Results for ..."
    re.compile(r"\bresults?\s+for\b", re.IGNORECASE),
    # "Jobs in [Location]"
    re.compile(r"\bjobs?\s+(?:in|near|around)\s+[A-Z]", re.IGNORECASE),
    # Platform names as sole content
    re.compile(
        r"^\s*(?:linkedin|indeed|glassdoor|ziprecruiter|monster|careerbuilder)\s*$",
        re.IGNORECASE,
    ),
    # "Browse/Search/Find jobs"
    re.compile(r"\b(?:browse|search|find|explore)\s+(?:jobs?|careers?)\b", re.IGNORECASE),
    # Pure numeric strings
    re.compile(r"^[\d\s,+.\-]+$"),
]


@dataclass
class TitleValidationResult:
    """
    Result of title extraction and validation.

    Attributes
    ----------
    title : str
        The cleaned, validated title — or empty string if invalid.
    is_valid : bool
        Whether the title passed all validation checks.
    should_flag_dlq : bool
        Whether this record should be routed to the Dead Letter Queue
        due to an unrecoverable title quality issue.
    rejection_reason : str
        Human-readable explanation if the title was rejected.
    """
    title: str = ""
    is_valid: bool = False
    should_flag_dlq: bool = False
    rejection_reason: str = ""


# ---------------------------------------------------------------------------
# Optional spaCy integration
# ---------------------------------------------------------------------------
def _try_load_spacy(model_name: str = "en_core_web_sm"):
    """
    Attempt to load a spaCy NLP pipeline with a custom Entity Ruler.

    Returns the nlp object if successful, None otherwise.
    The Entity Ruler is inserted BEFORE the default NER component so
    our custom SKILL patterns take precedence.
    """
    try:
        import spacy  # type: ignore

        try:
            nlp = spacy.load(model_name, disable=["ner"])
        except OSError:
            # Model not downloaded — create a blank English pipeline
            nlp = spacy.blank("en")
            logger.warning(
                "[NER] spaCy model '%s' not found. Using blank 'en' pipeline.", model_name
            )

        # Add custom Entity Ruler with SKILL patterns
        ruler = nlp.add_pipe("entity_ruler", before="ner") if "ner" in nlp.pipe_names else nlp.add_pipe("entity_ruler")

        # Build ruler patterns from our lexicon
        ruler_patterns = [
            {"label": "SKILL", "pattern": skill}
            for skill in _FLAT_SKILLS
        ]
        ruler.add_patterns(ruler_patterns)

        logger.info("[NER] spaCy Entity Ruler loaded with %d patterns.", len(ruler_patterns))
        return nlp

    except ImportError:
        logger.info("[NER] spaCy not installed — using lexicon-only extraction.")
        return None
    except Exception as exc:  # noqa: BLE001
        logger.warning("[NER] spaCy init failed (%s) — using lexicon-only extraction.", exc)
        return None


class CustomSkillExtractor:
    """
    Hybrid skill extractor combining lexicon matching + optional spaCy NER.

    Instantiation attempts to load spaCy once.  If unavailable, the
    extractor falls back gracefully to lexicon-only mode.

    Parameters
    ----------
    use_spacy : bool
        Whether to attempt spaCy loading.  Default True.
    spacy_model : str
        spaCy model name to load.  Default ``"en_core_web_sm"``.

    Usage
    -----
    >>> extractor = CustomSkillExtractor()
    >>> skills = extractor.extract_skills("5+ years Python, Django, and AWS experience")
    >>> print(skills)
    ['python', 'django', 'aws']
    """

    def __init__(self, use_spacy: bool = True, spacy_model: str = "en_core_web_sm") -> None:
        self._nlp = _try_load_spacy(spacy_model) if use_spacy else None
        self._use_spacy = self._nlp is not None
        # Canonicalize common synonyms/variants (standard list from JSON if provided)
        self._canonicalizer = SkillCanonicalizer(known_skills=None)

    def extract_skills(self, text: str) -> list[str]:
        """
        Extract technology/skill mentions from free text.

        Combines results from both extraction layers and deduplicates
        while preserving insertion order.

        Parameters
        ----------
        text : str
            Raw text (CV section, job description, skill field, …).

        Returns
        -------
        list[str]
            Deduplicated list of canonical skill names (lowercase),
            sorted by first appearance.

        Examples
        --------
        >>> extractor.extract_skills("Proficient in Python, React.js and PostgreSQL.")
        ['python', 'react.js', 'postgresql']
        """
        if not text:
            return []

        found: dict[str, int] = {}  # skill → first character position

        # ---------------------------------------------------------------
        # Layer 1 & 2: Lexicon matching (single + multi-word via regex)
        # Longest-match-first is guaranteed by _FLAT_SKILLS sort order.
        # We track positions to avoid double-counting overlapping matches.
        # ---------------------------------------------------------------
        covered_spans: list[tuple[int, int]] = []

        for skill, pattern in _SKILL_PATTERNS:
            for match in pattern.finditer(text):
                start, end = match.start(), match.end()
                # Skip if this span overlaps an already-matched longer skill
                if any(s <= start and end <= e for s, e in covered_spans):
                    continue
                covered_spans.append((start, end))
                if skill not in found:
                    found[skill] = start

        # ---------------------------------------------------------------
        # Layer 3: spaCy Entity Ruler (optional)
        # ---------------------------------------------------------------
        if self._use_spacy and self._nlp is not None:
            try:
                doc = self._nlp(text)
                for ent in doc.ents:
                    if ent.label_ == "SKILL":
                        skill_lower = ent.text.lower()
                        if skill_lower not in found:
                            found[skill_lower] = ent.start_char
            except Exception as exc:  # noqa: BLE001
                logger.warning("[NER] spaCy extraction failed: %s", exc)

        # Sort by first-appearance position and return canonical names
        skills_sorted = sorted(found.keys(), key=lambda s: found[s])
        canonical = self._canonicalizer.canonicalize_many(skills_sorted)
        logger.info("[NER] Extracted %d skills (canonical): %s", len(canonical), canonical)
        return canonical

    # -------------------------------------------------------------------
    # Title extraction & validation
    # -------------------------------------------------------------------

    def extract_and_validate_title(
        self,
        raw_title: str,
        ai_extracted_title: Optional[str] = None,
    ) -> TitleValidationResult:
        """
        Validate (and optionally refine) a job title, flagging garbage
        data for the Dead Letter Queue.

        The method accepts two inputs:

        1. ``raw_title`` — the title extracted by heuristic DOM scraping.
        2. ``ai_extracted_title`` — (optional) the title returned by an
           LLM that was prompted with ``TITLE_EXTRACTION_SYSTEM_PROMPT``.

        Validation pipeline
        -------------------
        1. Prefer ``ai_extracted_title`` if it is present and non-sentinel.
        2. Fall back to ``raw_title``.
        3. Apply regex rejection patterns to catch residual search metadata.
        4. Check word count (reject titles > 12 words or < 2 words).
        5. If the final title is still invalid, flag for DLQ.

        Parameters
        ----------
        raw_title : str
            Heuristic-extracted title from the scraper.
        ai_extracted_title : str, optional
            Title returned by the LLM extraction step.

        Returns
        -------
        TitleValidationResult
            Validated result with DLQ flag if needed.

        Examples
        --------
        >>> ext = CustomSkillExtractor(use_spacy=False)
        >>> r = ext.extract_and_validate_title("Senior Python Developer")
        >>> r.is_valid, r.title
        (True, 'Senior Python Developer')

        >>> r = ext.extract_and_validate_title("4,178,000+ jobs in United States")
        >>> r.is_valid, r.should_flag_dlq
        (False, True)
        """
        # ── Step 1: Choose best candidate ──────────────────────────────
        candidate = ""

        if ai_extracted_title:
            cleaned_ai = ai_extracted_title.strip()
            if cleaned_ai.lower() not in _INVALID_TITLE_SENTINELS:
                candidate = cleaned_ai

        if not candidate and raw_title:
            candidate = raw_title.strip()

        if not candidate:
            return TitleValidationResult(
                title="",
                is_valid=False,
                should_flag_dlq=True,
                rejection_reason="Both raw and AI titles are empty or sentinel values.",
            )

        # ── Step 2: Check sentinel values ──────────────────────────────
        if candidate.lower() in _INVALID_TITLE_SENTINELS:
            logger.warning(
                "[NER] Title is a sentinel value: '%s'", candidate
            )
            return TitleValidationResult(
                title="",
                is_valid=False,
                should_flag_dlq=True,
                rejection_reason=f"Title is a sentinel value: '{candidate}'",
            )

        # ── Step 3: Regex rejection patterns ───────────────────────────
        valid, reason = self._is_title_valid(candidate)
        if not valid:
            logger.warning(
                "[NER] Title rejected by validation: '%s' — %s",
                candidate[:100],
                reason,
            )
            return TitleValidationResult(
                title="",
                is_valid=False,
                should_flag_dlq=True,
                rejection_reason=reason,
            )

        logger.info("[NER] Title validated: '%s'", candidate)
        return TitleValidationResult(
            title=candidate,
            is_valid=True,
            should_flag_dlq=False,
            rejection_reason="",
        )

    @staticmethod
    def _is_title_valid(title: str) -> tuple[bool, str]:
        """
        Apply regex rejection patterns and structural checks to a title.

        Returns
        -------
        tuple[bool, str]
            ``(True, "")`` if valid, ``(False, reason)`` if rejected.
        """
        # Check against rejection patterns
        for pattern in _TITLE_REJECTION_PATTERNS:
            if pattern.search(title):
                return (
                    False,
                    f"Matches rejection pattern: {pattern.pattern!r}",
                )

        # Word-count check
        words = title.split()
        if len(words) < 2:
            return (
                False,
                f"Too few words ({len(words)}): '{title}'",
            )
        if len(words) > 12:
            return (
                False,
                f"Too many words ({len(words)}): '{title[:80]}'",
            )

        # Check minimum alphanumeric ratio (reject strings like "--- | ---")
        alnum_count = sum(1 for c in title if c.isalnum())
        if len(title) > 0 and alnum_count / len(title) < 0.50:
            return (
                False,
                f"Low alphanumeric ratio ({alnum_count}/{len(title)}): '{title[:80]}'",
            )

        return (True, "")
