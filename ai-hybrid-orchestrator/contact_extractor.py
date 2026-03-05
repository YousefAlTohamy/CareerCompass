"""
contact_extractor.py
====================
Regex-based Contact Information Extractor.

Extracts structured contact details from raw CV text:
  • email
  • phone  (local & international formats)
  • linkedin_url
  • github_url
  • location  (label-anchored heuristic)

Usage
-----
    from contact_extractor import extract_contacts
    info = extract_contacts(raw_cv_text)
"""

from __future__ import annotations

import re
from typing import Optional


# ── Compiled Patterns ──────────────────────────────────────────────────────────

# Email — RFC-5321 simplified
_EMAIL_RE = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
    re.IGNORECASE,
)

# Phone — handles:
#   +20 1012345678 | +1-800-555-0199 | (02) 12345678 | 01012345678 | +44 7911 123456
_PHONE_RE = re.compile(
    r"""
    (?:
        \+\d{1,3}           # country code  (+20, +1, +44 …)
        [\s\-.]?            # optional separator
    )?
    (?:\(\d{1,4}\)[\s\-.]?)?  # area code in parens: (02) | (800)
    \d{3,5}                   # first block
    [\s\-.]?
    \d{3,5}                   # second block
    (?:[\s\-.]?\d{2,5})?      # optional third block
    """,
    re.VERBOSE,
)

# LinkedIn — matches profile URLs with optional trailing path
_LINKEDIN_RE = re.compile(
    r"(?:https?://)?(?:www\.)?linkedin\.com/in/[A-Za-z0-9\-_%]+/?",
    re.IGNORECASE,
)

# GitHub — matches profile URLs (not sub-pages like /repos)
_GITHUB_RE = re.compile(
    r"(?:https?://)?(?:www\.)?github\.com/[A-Za-z0-9\-_.]+/?",
    re.IGNORECASE,
)

# Location — keyword-anchored: "Location:", "Address:", "Based in:", "City:"
_LOCATION_RE = re.compile(
    r"(?:location|address|based\s+in|city|residence|residing\s+in)\s*[:\-]?\s*(.+)",
    re.IGNORECASE,
)

# Noise filter for phone: pure digits or very short strings are false positives
_MIN_PHONE_LEN = 7


def _clean_phone(raw: str) -> Optional[str]:
    """Strip surrounding whitespace; reject strings too short to be a phone."""
    cleaned = raw.strip()
    digits = re.sub(r"\D", "", cleaned)
    return cleaned if len(digits) >= _MIN_PHONE_LEN else None


def _clean_location(raw: str) -> Optional[str]:
    """Trim and reject location candidates that are clearly too long (a full paragraph)."""
    cleaned = raw.strip().rstrip(".,;")
    return cleaned if 2 <= len(cleaned) <= 120 else None


# ── Public API ─────────────────────────────────────────────────────────────────

def extract_contacts(text: str) -> dict:
    """
    Extract structured contact information from raw CV text.

    Parameters
    ----------
    text : str
        Raw text extracted from a CV (PDF, DOCX, or image OCR output).

    Returns
    -------
    dict
        Keys: ``email``, ``phone``, ``linkedin_url``, ``github_url``, ``location``.
        Each value is a string if found, or ``None`` if not detected.
    """
    if not text:
        return {k: None for k in ("email", "phone", "linkedin_url", "github_url", "location")}

    # ── Email ──────────────────────────────────────────────────────────────────
    emails = _EMAIL_RE.findall(text)
    email = emails[0].lower() if emails else None

    # ── Phone ──────────────────────────────────────────────────────────────────
    phone_candidates = _PHONE_RE.findall(text)
    phone = None
    for candidate in phone_candidates:
        cleaned = _clean_phone(candidate)
        if cleaned:
            phone = cleaned
            break

    # ── LinkedIn ───────────────────────────────────────────────────────────────
    linkedin_matches = _LINKEDIN_RE.findall(text)
    linkedin_url = linkedin_matches[0] if linkedin_matches else None
    if linkedin_url and not linkedin_url.startswith("http"):
        linkedin_url = "https://" + linkedin_url

    # ── GitHub ─────────────────────────────────────────────────────────────────
    github_matches = _GITHUB_RE.findall(text)
    github_url = github_matches[0] if github_matches else None
    if github_url and not github_url.startswith("http"):
        github_url = "https://" + github_url

    # ── Location ───────────────────────────────────────────────────────────────
    location_match = _LOCATION_RE.search(text)
    location = _clean_location(location_match.group(1)) if location_match else None

    return {
        "email":        email,
        "phone":        phone,
        "linkedin_url": linkedin_url,
        "github_url":   github_url,
        "location":     location,
    }


# ── Quick self-test ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import json

    SAMPLE = """
    Ahmed Khames
    Location: Cairo, Egypt
    Email: ahmed.khames@gmail.com
    Phone: +20 101 234 5678
    LinkedIn: https://linkedin.com/in/ahmedkhames
    GitHub: github.com/ahmedkhames
    """

    result = extract_contacts(SAMPLE)
    print(json.dumps(result, indent=4))
