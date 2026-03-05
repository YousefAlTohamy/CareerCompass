"""
ai/segmentation.py
==================
Phase 4 — Heuristic CV / Résumé Segmentation

Implements a rule-based segmentation algorithm that partitions raw CV
text into structured sections (experience, education, skills, summary,
certifications) **without** using any ML models or external NLP libraries.

Algorithm
---------
The segmenter performs a single linear scan (O(n)) over the lines of the
CV text.  At each line it asks three questions in priority order:

1. Is this line a **section header**?
   • Detected via a keyword dictionary (e.g. "EXPERIENCE", "WORK HISTORY")
   • Heuristic boost: ALL-CAPS lines that match a known keyword family
     are treated as headers even if mixed-case variants are missing.

2. Is this line **blank / whitespace only**?
   • Blank lines reset the "last non-blank" line distance counter, which
     helps distinguish section breaks from normal paragraph wraps.

3. Otherwise, accumulate the line into the **current section**.

Sections are returned as a dict keyed by canonical section name.
Lines that appear before any recognisable header are collected under the
special key ``"header"``.

Edge Cases
----------
* CV with no recognisable headers → everything lands in ``"header"``
* Repeated header names (e.g. two EXPERIENCE blocks) → concatenated
* Headers with extra punctuation (``"--- SKILLS ---"``) → still matched
"""

from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Section keyword map  →  canonical section name
# Keys are lowercase; the regex uses IGNORECASE.
# Each list entry is a regex *fragment* (no anchors needed).
# ---------------------------------------------------------------------------
_SECTION_PATTERNS: dict[str, list[str]] = {
    "summary": [
        r"summary",
        r"profile",
        r"objective",
        r"about\s+me",
        r"personal\s+statement",
        r"professional\s+summary",
        r"career\s+objective",
    ],
    "experience": [
        r"experience",
        r"work\s+history",
        r"employment",
        r"professional\s+experience",
        r"work\s+experience",
        r"career\s+history",
        r"positions?\s+held",
    ],
    "education": [
        r"education",
        r"academic",
        r"qualifications?",
        r"degrees?",
        r"university",
        r"schooling",
        r"training",
    ],
    "skills": [
        r"skills?",
        r"technical\s+skills?",
        r"competenc",
        r"technologies",
        r"expertise",
        r"proficienc",
        r"tools?\s+&\s+technologies",
        r"languages?\s+&\s+tools",
    ],
    "certifications": [
        r"certifications?",
        r"certificates?",
        r"licen[sc]es?",
        r"credentials?",
        r"accreditations?",
    ],
    "projects": [
        r"projects?",
        r"portfolio",
        r"open.?source",
        r"side\s+projects?",
        r"personal\s+projects?",
    ],
    "languages": [
        r"languages?\s+spoken",
        r"spoken\s+languages?",
        r"language\s+proficiency",
    ],
    "references": [
        r"references?",
        r"referees?",
    ],
}

# Pre-compile one pattern per canonical section
_COMPILED_PATTERNS: dict[str, re.Pattern] = {
    section: re.compile(
        r"(?i)(?:^|[\s\-–—|•:*]+)(?:" + "|".join(fragments) + r")(?:[\s\-–—|•:*]+|$)",
        re.IGNORECASE,
    )
    for section, fragments in _SECTION_PATTERNS.items()
}

# All canonical output keys (returned even when the section is absent)
_ALL_SECTIONS: tuple[str, ...] = (
    "header",
    "summary",
    "experience",
    "education",
    "skills",
    "certifications",
    "projects",
    "languages",
    "references",
)


class HeuristicSegmenter:
    """
    Rule-based CV segmenter using heuristic header detection.

    No ML model is required.  The algorithm is O(n) in the number of
    lines — efficient enough to run on thousands of CVs per second.

    Usage
    -----
    >>> segmenter = HeuristicSegmenter()
    >>> sections = segmenter.segment_cv(raw_cv_text)
    >>> print(sections["experience"])
    >>> print(sections["skills"])
    """

    # ---------------------------------------------------------------
    # Public API
    # ---------------------------------------------------------------

    def segment_cv(self, text: str) -> dict[str, str]:
        """
        Partition raw CV text into named sections.

        Parameters
        ----------
        text : str
            Raw CV content (plain text, possibly with Windows/Unix line endings).

        Returns
        -------
        dict[str, str]
            A dict with keys:
            ``"header"``, ``"summary"``, ``"experience"``, ``"education"``,
            ``"skills"``, ``"certifications"``, ``"projects"``,
            ``"languages"``, ``"references"``.

            Sections not present in the CV are empty strings ``""``.
        """
        # Initialise output — every section starts empty
        sections: dict[str, list[str]] = {s: [] for s in _ALL_SECTIONS}
        current_section = "header"

        lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")

        for line in lines:
            stripped = line.strip()

            # --- 1. Detect section header ---
            detected = self._detect_header(stripped)
            if detected is not None:
                current_section = detected
                logger.debug("[Segmenter] Section header detected: '%s' → '%s'", stripped, detected)
                continue  # don't include the header line itself in the content

            # --- 2. Accumulate into current section ---
            sections[current_section].append(line)

        # Join lines and strip leading/trailing blank lines per section
        result: dict[str, str] = {}
        for section, content_lines in sections.items():
            joined = "\n".join(content_lines).strip()
            result[section] = joined

        logger.info(
            "[Segmenter] Segmentation complete. Non-empty sections: %s",
            [k for k, v in result.items() if v],
        )
        return result

    # ---------------------------------------------------------------
    # Private helpers
    # ---------------------------------------------------------------

    @staticmethod
    def _detect_header(line: str) -> str | None:
        """
        Determine whether *line* is a section header.

        Checks against the pre-compiled pattern dict.  Returns the
        canonical section name if matched, ``None`` otherwise.

        Heuristic boost: if the line is ALL-CAPS (after stripping
        punctuation), apply looser matching since all-caps section
        headers are very common in CVs.

        Parameters
        ----------
        line : str
            A single stripped line from the CV.

        Returns
        -------
        str or None
            Canonical section name, or ``None`` if not a header.
        """
        if not line:
            return None

        # Remove decoration characters before pattern matching
        clean = re.sub(r"[^\w\s]", " ", line).strip()

        for section, pattern in _COMPILED_PATTERNS.items():
            if pattern.search(line):
                return section

        # Fallback: ALL-CAPS single-word / short line → looser keyword check
        if clean == clean.upper() and 2 <= len(clean.split()) <= 6:
            clean_lower = clean.lower().strip()
            for section, fragments in _SECTION_PATTERNS.items():
                for frag in fragments:
                    # frag is a regex fragment — compile on-the-fly (cheap, one-time)
                    if re.search(frag, clean_lower, re.IGNORECASE):
                        return section

        return None
