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

# LinkedIn — matches full URLs or common short handles like "in/username"
_LINKEDIN_RE = re.compile(
    r"(?:(?:https?://)?(?:www\.)?linkedin\.com/in/|in/)([A-Za-z0-9\-_%]+)/?",
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

# Generic Website / Portfolio (excluding LinkedIn/GitHub)
# Looks for common TLDs but filters out major social platforms
_WEBSITE_RE = re.compile(
    r"(?:https?://)?(?:www\.)?([a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}(?:/\S*)?)",
    re.IGNORECASE,
)

# Noise filter for phone: pure digits or very short strings are false positives
_MIN_PHONE_LEN = 7


def _clean_phone(raw: str) -> Optional[str]:
    """Strip surrounding whitespace; reject strings too short to be a phone."""
    cleaned = raw.strip()
    digits = re.sub(r"\D", "", cleaned)
    return cleaned if len(digits) >= _MIN_PHONE_LEN else None


# Descriptive verbs that appear in project/body text — a real location won't start with these
from .utils import load_layer1_config
_config = load_layer1_config()["contact_config"]
_REJECT_LIST = "|".join(_config["location_reject_words"])
_LOCATION_REJECT_WORDS = re.compile(rf"\b({_REJECT_LIST})\b", re.IGNORECASE)


def _clean_location(raw: str) -> Optional[str]:
    """Trim, reject locations that are clearly too long or contain descriptive verbs."""
    cleaned = raw.strip().rstrip(".,;")
    if not (2 <= len(cleaned) <= 60):
        return None
    # Reject if it reads like a sentence (contains descriptive/action words)
    if _LOCATION_REJECT_WORDS.search(cleaned):
        return None
    # Reject if too many words (a real location is 1-4 words)
    if len(cleaned.split()) > 5:
        return None
    return cleaned


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
    linkedin_username = linkedin_matches[0] if linkedin_matches else None
    linkedin_url = f"https://www.linkedin.com/in/{linkedin_username}" if linkedin_username else None

    # ── GitHub ─────────────────────────────────────────────────────────────────
    github_matches = _GITHUB_RE.findall(text)
    github_url = github_matches[0] if github_matches else None
    if github_url and not github_url.startswith("http"):
        github_url = "https://" + github_url

    # ── Location ───────────────────────────────────────────────────────────────
    # Scope to first 20 lines only — contact info is always in the header area
    header_lines = text.splitlines()[:20]
    header_text = "\n".join(header_lines)
    location_match = _LOCATION_RE.search(header_text)
    location = _clean_location(location_match.group(1)) if location_match else None

    # Fallback: look for "City, Country" pattern in header lines
    if not location:
        for ln in header_lines:
            ln = ln.strip()
            # Pattern: "Word, Word" where each part is short (e.g. "Cairo, Egypt")
            # Pattern: "Word, Word" where each part is short (e.g. "Cairo, Egypt")
            # Using search but stopping at word boundary to avoid trailing noise
            m = re.search(r'([A-Z][\w\s]{1,20}),\s*([A-Z][\w\s]{2,20})\b', ln)
            if m:
                potential = m.group(0).strip()
                if not _LOCATION_REJECT_WORDS.search(potential):
                    location = potential
                    break

    # ── Portfolio / Website ──────────────────────────────────────────────────
    website_matches = _WEBSITE_RE.findall(text)
    portfolio_url = None
    for ws in website_matches:
        ws_low = ws.lower()
        # Filter out email domains, LinkedIn, GitHub, and common noise
        if email and ws_low in email.lower():
            continue
        if any(x in ws_low for x in ("linkedin.com", "github.com", "google.com", "facebook.com", "twitter.com", "instagram.com", "b.sc", "m.sc", "ph.d")):
            continue
        # If it looks like a real domain
        portfolio_url = ws if ws.startswith("http") else "https://" + ws
        break

    return {
        "email":         email,
        "phone":         phone,
        "linkedin_url":  linkedin_url,
        "github_url":    github_url,
        "location":      location,
        "portfolio_url": portfolio_url,
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
