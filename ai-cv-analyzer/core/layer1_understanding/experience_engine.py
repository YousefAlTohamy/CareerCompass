from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date, datetime
from typing import Iterable, List, Optional, Sequence, Tuple

logger = logging.getLogger(__name__)

try:
    from dateutil import parser as date_parser  # type: ignore

    DATEUTIL_AVAILABLE = True
except ImportError:
    DATEUTIL_AVAILABLE = False


PRESENT_WORDS = {"present", "current", "now", "today", "till date"}


@dataclass(frozen=True, slots=True)
class DateRange:
    start: date
    end: date
    source_text: str


class ExperienceEngine:
    """
    Temporal engine for calculating total experience duration.

    SRP: date-range extraction + temporal calculations ONLY.
    """

    # Common CV date range formats, e.g.:
    # - Jan 2020 - Mar 2022
    # - 2020 – Present
    # - 05/2019 to 11/2021
    # - 2018 - 2020
    _RANGE_RE = re.compile(
        r"(?P<start>"
        r"(?:\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b[\s,.-]*)?\b\d{4}\b"
        r"|(?:\b\d{1,2}[/-]\d{4}\b)"
        r"|(?:\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b)"
        r")"
        r"\s*(?:-+|–|—|to|until|~)\s*"
        r"(?P<end>"
        r"(?:\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b[\s,.-]*)?\b\d{4}\b"
        r"|(?:\b\d{1,2}[/-]\d{4}\b)"
        r"|(?:\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b)"
        r"|(?:\b(?:present|current|now|today|till date)\b)"
        r")",
        re.IGNORECASE,
    )

    def extract_date_ranges(self, experience_text: str | Iterable[str]) -> List[DateRange]:
        if not DATEUTIL_AVAILABLE:
            logger.error("python-dateutil is not installed; ExperienceEngine disabled.")
            return []

        text = (
            experience_text
            if isinstance(experience_text, str)
            else "\n".join(str(x) for x in experience_text)
        )
        if not text.strip():
            return []

        ranges: List[DateRange] = []
        for m in self._RANGE_RE.finditer(text):
            start_raw = (m.group("start") or "").strip()
            end_raw = (m.group("end") or "").strip()
            src = m.group(0).strip()

            start_dt = self._parse_date_safe(start_raw)
            end_dt = self._parse_date_safe(self._normalize_present(end_raw))

            if start_dt is None or end_dt is None:
                logger.warning("Skipping malformed date range: %r", src)
                continue

            if start_dt > end_dt:
                # Some CVs list end-start or OCR flips; attempt swap before skipping.
                start_dt, end_dt = end_dt, start_dt
                if start_dt > end_dt:
                    logger.warning("Skipping inverted date range after swap: %r", src)
                    continue

            ranges.append(DateRange(start=start_dt, end=end_dt, source_text=src))

        if not ranges:
            logger.info("No date ranges detected in experience text.")

        return ranges

    def calculate_total_experience_years(self, experience_text: str | Iterable[str]) -> float:
        """
        Returns total experience years as a float, merging overlapping intervals.
        """
        ranges = self.extract_date_ranges(experience_text)
        if not ranges:
            return 0.0

        merged = _merge_date_ranges([(r.start, r.end) for r in ranges])
        total_days = sum((end - start).days for start, end in merged)
        # Convert days to years (365.25 to approximate leap years)
        years = total_days / 365.25
        return round(float(max(0.0, years)), 2)

    def _normalize_present(self, s: str) -> str:
        if not s:
            return s
        if s.strip().lower() in PRESENT_WORDS:
            return date.today().isoformat()
        return s

    def _parse_date_safe(self, s: str) -> Optional[date]:
        """
        Wraps `dateutil` parsing with robust error handling.
        Uses a stable default so partial dates don't inherit "today".
        """
        if not s:
            return None
        try:
            default = datetime(1900, 1, 1)
            dt = date_parser.parse(s, default=default, fuzzy=True, dayfirst=False, yearfirst=False)
            return dt.date()
        except Exception as e:
            logger.warning("Date parse failed for %r: %s", s, e)
            return None


def _merge_date_ranges(ranges: Sequence[Tuple[date, date]]) -> List[Tuple[date, date]]:
    """
    Merge overlapping or touching ranges to avoid double-counting.
    """
    if not ranges:
        return []

    ordered = sorted(ranges, key=lambda r: (r[0], r[1]))
    merged: List[Tuple[date, date]] = []
    cur_start, cur_end = ordered[0]

    for start, end in ordered[1:]:
        if start <= cur_end:
            if end > cur_end:
                cur_end = end
        else:
            merged.append((cur_start, cur_end))
            cur_start, cur_end = start, end

    merged.append((cur_start, cur_end))
    return merged

