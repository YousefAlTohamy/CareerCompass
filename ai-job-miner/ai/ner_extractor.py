"""
ai/ner_extractor.py
====================
Phase 4 — Custom Skill Extraction Engine

Implements a hybrid skill extraction strategy that works reliably **without**
any ML model, but optionally leverages spaCy's Entity Ruler when available.

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
from typing import Optional

logger = logging.getLogger(__name__)


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
        logger.info("[NER] Extracted %d skills: %s", len(skills_sorted), skills_sorted)
        return skills_sorted
