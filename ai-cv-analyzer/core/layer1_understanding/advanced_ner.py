from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

logger = logging.getLogger(__name__)


try:
    from transformers import pipeline

    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False


@dataclass(frozen=True, slots=True)
class NameCandidate:
    full_name: str
    confidence_score: float
    source_line: str


class AdvancedNEREngine:
    """
    V2 entity extraction engine.

    SRP: run NER and apply context-window filtering for skills.
    """

    _instance: Optional["AdvancedNEREngine"] = None

    def __new__(cls) -> "AdvancedNEREngine":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._init_pipeline()
        return cls._instance

    def _init_pipeline(self) -> None:
        self._ner = None
        if not TRANSFORMERS_AVAILABLE:
            logger.error("HuggingFace Transformers not installed; AdvancedNEREngine disabled.")
            return

        model_name = self._resolve_model_name()
        try:
            # NOTE: no aggregation_strategy -> keep raw token offsets for robust context windows.
            self._ner = pipeline("ner", model=model_name, tokenizer=model_name)
            logger.info("AdvancedNEREngine loaded NER model: %s", model_name)
        except Exception as e:
            logger.exception("Failed to initialize NER pipeline (%s): %s", model_name, e)
            self._ner = None

    def _resolve_model_name(self) -> str:
        """
        Prefer a local fine-tuned CV model if present, otherwise fall back.
        """
        current_dir = os.path.dirname(os.path.abspath(__file__))
        base_dir = os.path.abspath(os.path.join(current_dir, "..", ".."))
        custom = os.path.join(base_dir, "models", "ner_weights", "career_compass_ner_final")
        if os.path.exists(custom):
            return custom
        return "dslim/bert-base-NER"

    def extract_entities(
        self,
        text: str,
        *,
        context_window_words: int = 3,
    ) -> Dict[str, List[str]]:
        """
        Returns normalized entities grouped into logical categories.

        Expected label set for the fine-tuned model:
        - SKILL, ROLE, EDU, CERT

        Fallback model (dslim/bert-base-NER) yields PER/ORG/LOC/MISC; in that case
        we only populate `people/orgs/locations/misc` without skill filtering.
        """
        if not text or self._ner is None:
            return {
                "skills": [],
                "roles": [],
                "education": [],
                "certifications": [],
                "people": [],
                "orgs": [],
                "locations": [],
                "misc": [],
            }

        try:
            # Enforce manual chunking/truncation if text is absurdly large
            # This minimizes memory spikes on 10MB+ PDF files.
            safe_text = text[:10000] if len(text) > 10000 else text
            tokens = self._ner(safe_text)
        except Exception as e:
            logger.exception("NER inference failed: %s", e)
            return {
                "skills": [],
                "roles": [],
                "education": [],
                "certifications": [],
                "people": [],
                "orgs": [],
                "locations": [],
                "misc": [],
            }

        # Word spans for context-window filtering (character-aligned).
        word_spans = _build_word_spans(text)

        grouped: Dict[str, List[str]] = {
            "skills": [],
            "roles": [],
            "education": [],
            "certifications": [],
            "people": [],
            "orgs": [],
            "locations": [],
            "misc": [],
        }

        # Determine which label family we are dealing with.
        has_custom_labels = any(str(t.get("entity", "")).endswith(("SKILL", "ROLE", "EDU", "CERT")) for t in tokens)

        if has_custom_labels:
            merged = _merge_ner_tokens(tokens, safe_text)
            for ent_text, ent_label, (start, end), _score in merged:
                if not ent_text:
                    continue

                base = ent_label.split("-")[-1] if "-" in ent_label else ent_label
                if base == "SKILL":
                    if _should_keep_skill(
                        ent_text,
                        start,
                        end,
                        word_spans,
                        window=context_window_words,
                    ):
                        grouped["skills"].append(ent_text)
                elif base == "ROLE":
                    grouped["roles"].append(ent_text)
                elif base == "EDU":
                    grouped["education"].append(ent_text)
                elif base == "CERT":
                    grouped["certifications"].append(ent_text)

        else:
            merged = _merge_ner_tokens(tokens, safe_text)
            for ent_text, ent_label, _span, _score in merged:
                base = ent_label.split("-")[-1] if "-" in ent_label else ent_label
                if base in ("PER", "PERSON"):
                    grouped["people"].append(ent_text)
                elif base in ("ORG", "ORGANIZATION"):
                    grouped["orgs"].append(ent_text)
                elif base in ("LOC", "LOCATION"):
                    grouped["locations"].append(ent_text)
                else:
                    grouped["misc"].append(ent_text)

        # De-duplicate while keeping order.
        for k, vals in grouped.items():
            grouped[k] = _dedupe_preserve_order(vals)

        return grouped

    def extract_candidate_name(
        self,
        profile_lines: Sequence[str] | str,
        entities: Optional[Dict[str, List[str]]] = None,
    ) -> Optional[NameCandidate]:
        """
        Name heuristic:
        - If `entities` contains 'people' and one is found in the first 500 chars, use it.
        - Otherwise, fall back to the first non-empty line that is not a URL/email/phone-heavy,
          not numeric, and looks like a human name.
        """
        if isinstance(profile_lines, str):
            raw_text = profile_lines
            lines = [ln.strip() for ln in profile_lines.splitlines()]
        else:
            raw_text = "\n".join(str(ln) for ln in profile_lines)
            lines = [str(ln).strip() for ln in profile_lines]

        # 1. Try NER-based extraction first
        if entities and entities.get("people"):
            first_500 = raw_text[:500]
            for person in entities["people"]:
                person_clean = person.strip()
                if person_clean and person_clean in first_500:
                    conf = 0.95
                    source_line = next((ln for ln in lines if person_clean in ln), person_clean)
                    return NameCandidate(full_name=person_clean, confidence_score=conf, source_line=source_line)

        for line in lines:
            if not line:
                continue
            if _looks_like_contact_line(line):
                continue
            if _is_mostly_numeric_or_symbols(line):
                continue

            candidate = _normalize_name_candidate(line)
            if candidate is None:
                continue

            conf = 0.88
            if 1 <= len(candidate.split()) <= 4:
                conf = 0.93
            return NameCandidate(full_name=candidate, confidence_score=conf, source_line=line)

        logger.info("Name heuristic: no suitable name line found.")
        return None


_WORD_RE = re.compile(r"\S+")
_EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
_URL_RE = re.compile(r"\b(?:https?://|www\.)\S+\b", re.IGNORECASE)
_PHONE_RE = re.compile(r"(?:\+?\d[\d\s().-]{7,}\d)")


def _build_word_spans(text: str) -> List[Tuple[str, int, int]]:
    spans: List[Tuple[str, int, int]] = []
    for m in _WORD_RE.finditer(text):
        spans.append((m.group(0), m.start(), m.end()))
    return spans


def _merge_ner_tokens(tokens: Iterable[dict], original_text: str) -> List[Tuple[str, str, Tuple[int, int], float]]:
    """
    Merges subword tokens and groups B/I tags using offset_mapping to slice original text.
    Returns: [(entity_text, entity_label, (start, end), confidence_score), ...]
    """
    merged: List[Tuple[str, str, Tuple[int, int], float]] = []

    cur_label: Optional[str] = None
    cur_start: Optional[int] = None
    cur_end: Optional[int] = None
    cur_scores: List[float] = []

    def flush() -> None:
        nonlocal cur_label, cur_start, cur_end, cur_scores
        if cur_label and cur_start is not None and cur_end is not None:
            # Slice exactly from original text to prevent character dropping
            ent_text = original_text[cur_start:cur_end]
            ent_text = _clean_entity_text(ent_text)
            if ent_text:
                avg_score = sum(cur_scores) / len(cur_scores) if cur_scores else 0.0
                merged.append((ent_text, cur_label, (cur_start, cur_end), avg_score))
        cur_label = None
        cur_start = None
        cur_end = None
        cur_scores = []

    last_end = -1
    for t in tokens:
        word = str(t.get("word", "") or "")
        label = str(t.get("entity", "") or "")
        start = int(t.get("start", -1) or -1)
        end = int(t.get("end", -1) or -1)
        score = float(t.get("score", 0.0) or 0.0)
        
        if not word or start < 0 or end < 0:
            continue

        base = label.split("-")[-1] if "-" in label else label
        is_inside = label.startswith("I-")
        is_begin = label.startswith("B-")
        is_subword = word.startswith("##")

        if cur_label is None:
            cur_label = base
            cur_start = start
            cur_end = end
            cur_scores.append(score)
            last_end = end
            continue

        # Merge condition:
        # 1. Same base label AND it's an I- tag
        # 2. It's a subword (starts with ##)
        # 3. EXACT adjacent tokens without space (start == last_end) and not a B- tag
        merge = False
        is_same_base = (base == cur_label)

        if is_same_base:
            if is_inside:
                merge = True
            elif is_subword:
                merge = True
            elif start == last_end and not is_begin:
                merge = True
        elif is_subword:
            # Allow merging subword even if model incorrectly predicted different base
            merge = True

        if merge:
            cur_end = max(cur_end, end)
            cur_scores.append(score)
        else:
            flush()
            cur_label = base
            cur_start = start
            cur_end = end
            cur_scores.append(score)

        last_end = end

    flush()
    return merged


def _clean_entity_text(s: str) -> str:
    s = re.sub(r"\s+", " ", s).strip()
    # Trim stray punctuation often produced by token merges
    return s.strip(" ,;:|/-")


def _should_keep_skill(
    skill: str,
    start: int,
    end: int,
    word_spans: Sequence[Tuple[str, int, int]],
    *,
    window: int,
) -> bool:
    """
    Sanity Check Filter:
    Trust the NER model for SKILL tokens, but apply basic sanity checks
    (e.g., length > 1, not purely numeric).
    """
    clean = skill.strip()
    if not clean:
        return False

    # Check minimum length (allow C, R, etc as length 1 exceptions)
    if len(clean) <= 1 and clean.upper() not in {"C", "R"}:
        return False

    # Check if purely numeric
    if clean.isdigit():
        return False

    return True


def _dedupe_preserve_order(items: Sequence[str]) -> List[str]:
    seen: set[str] = set()
    out: List[str] = []
    for x in items:
        k = x.strip().lower()
        if not k or k in seen:
            continue
        seen.add(k)
        out.append(x.strip())
    return out


def _looks_like_contact_line(line: str) -> bool:
    if _EMAIL_RE.search(line) or _URL_RE.search(line) or _PHONE_RE.search(line):
        return True
    # Lines with many separators are usually contact blocks.
    sep_count = sum(line.count(ch) for ch in ("@", "|", "/", "\\"))
    return sep_count >= 2


def _is_mostly_numeric_or_symbols(line: str) -> bool:
    letters = sum(ch.isalpha() for ch in line)
    digits = sum(ch.isdigit() for ch in line)
    if digits >= 6 and letters == 0:
        return True
    # If very few letters overall, treat as non-name.
    return letters <= 1 and digits >= 2


_NAME_BAD_TOKENS = {
    "resume",
    "curriculum",
    "vitae",
    "cv",
    "profile",
    "summary",
    "experience",
    "education",
    "skills",
    "projects",
}


def _normalize_name_candidate(line: str) -> Optional[str]:
    s = re.sub(r"\s+", " ", line).strip()
    s = s.strip("-–—|:•·*")
    if not s:
        return None
    if len(s) > 60:
        return None

    parts = [p for p in re.split(r"\s+", s) if p]
    if not (1 <= len(parts) <= 5):
        return None

    # Reject if it looks like a section header rather than a name.
    lowered = " ".join(parts).lower()
    if lowered in _NAME_BAD_TOKENS:
        return None
    if any(tok in _NAME_BAD_TOKENS for tok in lowered.split()):
        # Allow "John Doe - Software Engineer" to pass by trimming trailing title.
        if "-" in s or "|" in s:
            head = re.split(r"[-|]", s, maxsplit=1)[0].strip()
            return _normalize_name_candidate(head)
        return None

    # Heuristic: at least one alphabetic character per token.
    if any(not any(ch.isalpha() for ch in p) for p in parts):
        return None

    # Title-case-ish check (works for most Latin names).
    alpha_tokens = [p for p in parts if any(ch.isalpha() for ch in p)]
    capital_like = sum(1 for p in alpha_tokens if p[:1].isupper())
    if capital_like >= max(1, len(alpha_tokens) - 1):
        return " ".join(parts)

    # If not capitalized, still allow 2-3 word names without digits.
    if 2 <= len(parts) <= 3 and not any(any(ch.isdigit() for ch in p) for p in parts):
        return " ".join(parts)

    return None

