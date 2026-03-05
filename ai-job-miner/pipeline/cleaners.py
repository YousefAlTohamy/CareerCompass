"""
pipeline/cleaners.py
=====================
Phase 3 — Text Cleaning & Semantic Extraction

Implements a set of pure, composable functions that transform raw,
noisy scraper output into clean, structured data.

The pipeline philosophy: each function does ONE thing, takes a string,
and returns a string or dict.  Functions can be composed freely.

Functions
---------
clean_text(text)           — strip HTML tags, normalize Unicode & whitespace
remove_noise(title)        — remove job-title noise words via Regex FSM
extract_salary(text)       — parse salary ranges into a structured dict
extract_experience(text)   — parse experience requirements into a dict
extract_job_type(text)     — classify employment type (Full-time, Contract …)
extract_work_model(text)   — classify work model (Remote, Hybrid, On-site)
extract_working_hours(text) — extract working-hours pattern from free text

CS Concept: Regex as FSM
-------------------------
Python's ``re`` module compiles patterns into a deterministic finite
automaton (DFA).  Each ``re.sub`` / ``re.search`` call is a DFA
traversal over the input string — O(n) in the string length, with no
backtracking for most non-pathological patterns.
"""

from __future__ import annotations

import html
import logging
import re
import unicodedata
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Noise words removed from job titles
# The word-boundary ``\b`` assertion ensures we never partially match
# a word (e.g., 'urgently' must NOT be matched by the rule for 'urgent').
# ---------------------------------------------------------------------------
_NOISE_WORDS: tuple[str, ...] = (
    "urgent",
    "urgently",
    "hiring now",
    "we are hiring",
    "join us",
    "remote",
    "onsite",
    "on-site",
    "hybrid",
    "full.?time",
    "part.?time",
    "contract",
    "freelance",
    "immediate",
    "opening",
    "vacancy",
    "vacancies",
    "job",
    "position",
    "role",
    "opportunity",
    "opportunities",
    "needed",
    "required",
    "wanted",
    "hiring",
)

# Pre-compile a single alternation pattern for O(|title|) matching
_NOISE_PATTERN: re.Pattern = re.compile(
    r"(?i)\b(?:" + "|".join(_NOISE_WORDS) + r")\b[:\-–,]?\s*",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# Currency symbols / codes mapped to ISO 4217 codes
# ---------------------------------------------------------------------------
_CURRENCY_MAP: dict[str, str] = {
    "$": "USD",
    "£": "GBP",
    "€": "EUR",
    "¥": "JPY",
    "₹": "INR",
    "egp": "EGP",
    "usd": "USD",
    "gbp": "GBP",
    "eur": "EUR",
    "jpy": "JPY",
    "inr": "INR",
    "sar": "SAR",
    "aed": "AED",
}


# ===========================================================================
# 1. clean_text
# ===========================================================================

def clean_text(text: str) -> str:
    """
    Produce clean, plain-text from raw, potentially HTML-contaminated input.

    Pipeline
    --------
    1. Unescape HTML entities (``&amp;`` → ``&``, ``&lt;`` → ``<`` …).
    2. Strip all remaining HTML / XML tags with a simple regex.
    3. Normalize Unicode to NFC (canonical composition).
    4. Replace all whitespace sequences (space, tab, newline, nbsp …)
       with a single ASCII space.
    5. Strip leading/trailing whitespace.

    Parameters
    ----------
    text : str
        Raw input — may contain HTML tags, entities, excessive whitespace,
        and non-ASCII Unicode artefacts.

    Returns
    -------
    str
        Clean, ASCII-safe plain text.

    Examples
    --------
    >>> clean_text("<p>  Python &amp; Django  \\n  Developer  </p>")
    'Python & Django Developer'
    """
    if not text:
        return ""

    # 1. Unescape HTML entities (&amp; &lt; &gt; &#x27; …)
    text = html.unescape(text)

    # 2. Strip HTML/XML tags (handles nested angle brackets conservatively)
    text = re.sub(r"<[^>]+>", " ", text)

    # 3. Unicode NFC normalisation (resolves composed vs. decomposed forms)
    text = unicodedata.normalize("NFC", text)

    # 4. Replace all whitespace variants (including \u00a0 nbsp) with a space
    text = re.sub(r"[\s\u00a0]+", " ", text)

    # 5. Strip
    return text.strip()


# ===========================================================================
# 2. remove_noise
# ===========================================================================

def remove_noise(title: str) -> str:
    """
    Remove boilerplate noise words from a job title string.

    Uses a pre-compiled Regex DFA (``_NOISE_PATTERN``) with word-boundary
    anchors so only whole-word matches are removed.  After removal,
    residual punctuation and whitespace are cleaned up.

    Parameters
    ----------
    title : str
        Raw job title (e.g. ``"Urgent: Python Developer (Remote) Full Time"``).

    Returns
    -------
    str
        Cleaned title with noise words stripped.

    Examples
    --------
    >>> remove_noise("Urgent: Python Dev (Remote)")
    'Python Dev'

    >>> remove_noise("Hiring Now! Senior Backend Engineer - Contract")
    'Senior Backend Engineer'
    """
    if not title:
        return ""

    # Remove noise words using the compiled DFA pattern
    cleaned = _NOISE_PATTERN.sub(" ", title)

    # Strip residual brackets / dashes / punctuation left by removal
    cleaned = re.sub(r"[\(\)\[\]]+", " ", cleaned)
    cleaned = re.sub(r"^\s*[-–—:,!.]+\s*|\s*[-–—:,!.]+\s*$", "", cleaned)

    # Collapse multi-spaces and strip
    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()

    logger.debug("[cleaners.remove_noise] '%s' → '%s'", title, cleaned)
    return cleaned


# ===========================================================================
# 3. extract_salary
# ===========================================================================

def extract_salary(text: str) -> dict:
    """
    Parse a free-text salary string into a structured dict using Regex FSM.

    Supported formats (all case-insensitive)
    -----------------------------------------
    * ``"$10,000 - $15,000"``
    * ``"10k - 15k USD"``
    * ``"10,000 to 15,000 EGP"``
    * ``"£50,000 per annum"``
    * ``"80000"``  (single value — min == max)
    * ``"+10k"`` / ``"10k+"``

    Algorithm
    ---------
    1. Detect currency symbol / code (mapped to ISO 4217).
    2. Extract all numeric tokens (handles commas and "k" multiplier).
    3. Classify as ``(min, max)`` or ``(single, single)`` based on count.

    Parameters
    ----------
    text : str
        Free-text salary description.

    Returns
    -------
    dict
        ::

            {
                "min_salary": int | None,
                "max_salary": int | None,
                "currency":   str | None,   # ISO 4217, e.g. "USD"
            }

    Examples
    --------
    >>> extract_salary("10k - 12k USD")
    {'min_salary': 10000, 'max_salary': 12000, 'currency': 'USD'}

    >>> extract_salary("$10,000 to $15,000")
    {'min_salary': 10000, 'max_salary': 15000, 'currency': 'USD'}
    """
    _empty: dict = {"min_salary": None, "max_salary": None, "currency": None}

    if not text:
        return _empty

    text_lower = text.lower().strip()

    # ------------------------------------------------------------------
    # 1. Detect currency
    # ------------------------------------------------------------------
    currency: Optional[str] = None

    # Check symbol first (order matters — check longer codes before single chars)
    for key in sorted(_CURRENCY_MAP, key=len, reverse=True):
        if key in text_lower:
            currency = _CURRENCY_MAP[key]
            break

    # ------------------------------------------------------------------
    # 2. Extract all numeric tokens (handles commas and 'k' suffix)
    # Format: optional sign, digits with optional commas, optional 'k'
    # ------------------------------------------------------------------
    number_pattern = re.compile(
        r"\+?\s*(\d[\d,]*(?:\.\d+)?)\s*k?\b",
        re.IGNORECASE,
    )

    # We use a dedicated k-aware pattern to correctly scale
    k_pattern = re.compile(
        r"\+?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)\b",
        re.IGNORECASE,
    )

    # Find all (value, has_k) pairs
    raw_matches: list[tuple[str, bool]] = []
    # Use finditer on a clean token (currency symbols removed)
    clean = re.sub(r"[$£€¥₹]", " ", text_lower)

    for match in re.finditer(r"(\+?\s*\d[\d,]*(?:\.\d+)?)\s*(k?)\b", clean, re.IGNORECASE):
        num_str = match.group(1).replace(",", "").replace(" ", "").lstrip("+")
        has_k = bool(match.group(2))
        raw_matches.append((num_str, has_k))

    if not raw_matches:
        logger.warning("[cleaners.extract_salary] No numeric values found in: '%s'", text)
        return _empty

    def _to_int(num_str: str, has_k: bool) -> int:
        value = float(num_str)
        if has_k:
            value *= 1000
        return int(value)

    values = [_to_int(s, k) for s, k in raw_matches]

    if len(values) == 1:
        result = {"min_salary": values[0], "max_salary": values[0], "currency": currency}
    else:
        result = {"min_salary": min(values), "max_salary": max(values), "currency": currency}

    logger.debug("[cleaners.extract_salary] '%s' → %s", text, result)
    return result


# ===========================================================================
# 4. extract_experience
# ===========================================================================

def extract_experience(text: str) -> dict:
    """
    Parse an experience requirement string into a structured dict.

    Supported formats
    -----------------
    * ``"3-5 years"``  / ``"3-5 yrs"``
    * ``"+3 years"``   / ``"3+ years"``
    * ``"at least 2 years"``
    * ``"minimum 5 years"``
    * ``"5 years"``  (single value — min == max)
    * ``"0-1 year"``

    Parameters
    ----------
    text : str
        Free-text experience requirement.

    Returns
    -------
    dict
        ::

            {
                "min_exp": int | None,
                "max_exp": int | None,
            }

    Examples
    --------
    >>> extract_experience("3-5 yrs experience")
    {'min_exp': 3, 'max_exp': 5}

    >>> extract_experience("+3 years")
    {'min_exp': 3, 'max_exp': None}
    """
    _empty: dict = {"min_exp": None, "max_exp": None}

    if not text:
        return _empty

    text_lower = text.lower()

    # Pattern 1: range — "3-5 years" / "3 to 5 yrs"
    range_match = re.search(
        r"(\d+)\s*(?:[-–to]+)\s*(\d+)\s*(?:year|yr|yrs|years)?",
        text_lower,
    )
    if range_match:
        lo, hi = int(range_match.group(1)), int(range_match.group(2))
        result = {"min_exp": min(lo, hi), "max_exp": max(lo, hi)}
        logger.debug("[cleaners.extract_experience] range '%s' → %s", text, result)
        return result

    # Pattern 2: minimum only — "+3 years" / "3+ years" / "at least 3" / "minimum 3"
    #   Requires an *explicit* min indicator so plain "5 years" falls through.
    min_only_match = re.search(
        r"(?:"
        r"(?:at\s+least|minimum|min\.?)\s+(\d+)"  # "at least 3 years" / "minimum 3 yrs"
        r"|"
        r"\+\s*(\d+)\s*(?:year|yr|yrs|years)"      # "+3 years"
        r"|"
        r"(\d+)\s*\+\s*(?:year|yr|yrs|years)"      # "3+ years"
        r")",
        text_lower,
    )
    if min_only_match:
        val = int(next(g for g in min_only_match.groups() if g is not None))
        result = {"min_exp": val, "max_exp": None}
        logger.debug("[cleaners.extract_experience] min-only '%s' → %s", text, result)
        return result

    # Pattern 3: single number anywhere
    single_match = re.search(r"(\d+)", text_lower)
    if single_match:
        val = int(single_match.group(1))
        result = {"min_exp": val, "max_exp": val}
        logger.debug("[cleaners.extract_experience] single '%s' → %s", text, result)
        return result

    logger.warning("[cleaners.extract_experience] No experience tokens in: '%s'", text)
    return _empty


# ===========================================================================
# 5. extract_job_type
# ===========================================================================

# Pre-compiled patterns — ordered from most to least specific so that
# "Full-time" is tried before a generic single-word fallback.
_JOB_TYPE_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\bfull[\s\-]?time\b", re.IGNORECASE), "Full-time"),
    (re.compile(r"\bpart[\s\-]?time\b", re.IGNORECASE), "Part-time"),
    (re.compile(r"\binternship\b",       re.IGNORECASE), "Internship"),
    (re.compile(r"\bfreelance\b",        re.IGNORECASE), "Freelance"),
    (re.compile(r"\bcontract\b",         re.IGNORECASE), "Contract"),
]


def extract_job_type(text: str) -> str:
    """
    Classify the employment type by scanning free text for known keywords.

    Patterns are tried in priority order (most-specific first) so that
    "Full-time Contract" resolves to "Full-time" rather than "Contract".

    Parameters
    ----------
    text : str
        Any free-form job text (title, description, metadata).

    Returns
    -------
    str
        One of: ``"Full-time"``, ``"Part-time"``, ``"Internship"``,
        ``"Freelance"``, ``"Contract"``, or ``"Unspecified"``.

    Examples
    --------
    >>> extract_job_type("Senior Python Dev – Full-time position")
    'Full-time'
    >>> extract_job_type("3-month contract role")
    'Contract'
    """
    if not text:
        return "Unspecified"
    for pattern, label in _JOB_TYPE_PATTERNS:
        if pattern.search(text):
            logger.debug("[cleaners.extract_job_type] matched '%s'", label)
            return label
    return "Unspecified"


# ===========================================================================
# 6. extract_work_model
# ===========================================================================

_WORK_MODEL_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\bhybrid\b",             re.IGNORECASE), "Hybrid"),
    (re.compile(r"\bremote\b",             re.IGNORECASE), "Remote"),
    (re.compile(r"\bon[\s\-]?site\b",      re.IGNORECASE), "On-site"),
    (re.compile(r"\bin[\s\-]?office\b",    re.IGNORECASE), "On-site"),
    (re.compile(r"\bin[\s\-]?person\b",    re.IGNORECASE), "On-site"),
]


def extract_work_model(text: str) -> str:
    """
    Classify the work model by scanning free text for known keywords.

    "Hybrid" is tested before "Remote" so that "Hybrid-remote" does not
    mis-classify as purely Remote.

    Parameters
    ----------
    text : str
        Any free-form job text.

    Returns
    -------
    str
        One of: ``"Remote"``, ``"Hybrid"``, ``"On-site"``, or
        ``"Unspecified"``.

    Examples
    --------
    >>> extract_work_model("This is a hybrid role based in London")
    'Hybrid'
    >>> extract_work_model("Fully remote position")
    'Remote'
    """
    if not text:
        return "Unspecified"
    for pattern, label in _WORK_MODEL_PATTERNS:
        if pattern.search(text):
            logger.debug("[cleaners.extract_work_model] matched '%s'", label)
            return label
    return "Unspecified"


# ===========================================================================
# 7. extract_working_hours
# ===========================================================================

# Each tuple: (compiled_pattern, human_readable_template)
# Groups in the pattern are interpolated into the template where present.
_HOURS_PATTERNS: list[tuple[re.Pattern, str]] = [
    # "40 hours/week", "40 hrs per week"
    (
        re.compile(r"(\d+)\s*(?:hours?|hrs?)\s*(?:per|/|a)\s*week", re.IGNORECASE),
        "{0} hours/week",
    ),
    # "9 to 5", "9-5", "9 am to 6 pm"
    (
        re.compile(
            r"(\d{1,2})\s*(?:am|AM)?\s*(?:to|[-–])\s*(\d{1,2})\s*(?:pm|PM)?",
            re.IGNORECASE,
        ),
        "{0} to {1}",
    ),
    # "night shift", "morning shift", "evening shift"
    (
        re.compile(r"(night|morning|evening|day|afternoon)\s+shift", re.IGNORECASE),
        "{0} shift",
    ),
    # "flexible hours", "flexible working"
    (
        re.compile(r"flex(?:ible)?\s*(?:hours?|working|schedule)?", re.IGNORECASE),
        "Flexible hours",
    ),
    # "rotating shifts"
    (
        re.compile(r"rotating\s+shifts?", re.IGNORECASE),
        "Rotating shifts",
    ),
]


def extract_working_hours(text: str) -> str:
    """
    Extract a working-hours description from free text using Regex FSM.

    Patterns are matched in priority order.  The first match is returned.
    Returns an empty string if no pattern matches.

    Parameters
    ----------
    text : str
        Any free-form job text.

    Returns
    -------
    str
        A normalised hours string (e.g. ``"40 hours/week"``, ``"9 to 5"``,
        ``"Night shift"``, ``"Flexible hours"``), or ``""`` if not found.

    Examples
    --------
    >>> extract_working_hours("We offer flexible hours and remote work")
    'Flexible hours'
    >>> extract_working_hours("40 hrs/week, night shift available")
    '40 hours/week'
    """
    if not text:
        return ""
    for pattern, template in _HOURS_PATTERNS:
        m = pattern.search(text)
        if m:
            groups = m.groups()
            result = template.format(*groups) if groups else template
            # Capitalise the first letter for consistent presentation
            result = result[0].upper() + result[1:]
            logger.debug("[cleaners.extract_working_hours] matched '%s'", result)
            return result
    return ""
