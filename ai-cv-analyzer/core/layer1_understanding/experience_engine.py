from __future__ import annotations

import logging
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from typing import TYPE_CHECKING, Dict, Iterable, List, Optional, Sequence, Tuple

if TYPE_CHECKING:
    from core.layer1_understanding.schema import ExperienceItem

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
        r"|(?:\b\d{1,2}\s*[./-]\s*\d{4}\b)"
        r"|(?:\b\d{1,2}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{2,4}\b)"
        r")"
        r"\s*(?:-+|–|—|to|until|~)\s*"
        r"(?P<end>"
        r"(?:\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b[\s,.-]*)?\b\d{4}\b"
        r"|(?:\b\d{1,2}\s*[./-]\s*\d{4}\b)"
        r"|(?:\b\d{1,2}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{2,4}\b)"
        r"|(?:\b(?:present|current|now|today|till date)\b)"
        r")",
        re.IGNORECASE,
    )

    # Secondary scan to cleanly capture basic formats missed by the primary scan
    _FALLBACK_RANGE_RE = re.compile(
        r"(?P<start>(?:\b[A-Za-z]{3,9}\s+)?\b(?:19|20)\d{2}\b)"
        r"\s*(?:-|to|until|–|—|~)\s*"
        r"(?P<end>(?:\b[A-Za-z]{3,9}\s+)?\b(?:19|20)\d{2}\b|\b(?:present|current|now|today|till date)\b)",
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

        # --- SECONDARY REGEX FALLBACK ---
        if not ranges:
            logger.info("Primary date regex missed. Running fallback scan...")
            for m in self._FALLBACK_RANGE_RE.finditer(text):
                start_raw = (m.group("start") or "").strip()
                end_raw = (m.group("end") or "").strip()
                src = m.group(0).strip()

                start_dt = self._parse_date_safe(start_raw)
                end_dt = self._parse_date_safe(self._normalize_present(end_raw))

                if start_dt is None or end_dt is None:
                    continue

                if start_dt > end_dt:
                    start_dt, end_dt = end_dt, start_dt
                    if start_dt > end_dt:
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

    # ------------------------------------------------------------------
    # Phase 2: Per-skill duration (Temporal Data Mapping)
    # ------------------------------------------------------------------

    def calculate_skill_durations(
        self,
        experience_items: List[ExperienceItem],
    ) -> Dict[str, float]:
        """
        Compute the effective duration (in years) for each technology
        across all experience items.

        Overlap handling:
        - If two jobs run concurrently and both list "Python", the
          overlapping interval is counted only once via `_merge_date_ranges`.

        Items with ``start_date is None`` or ``end_date is None`` are
        skipped for duration purposes — their skills will still appear in
        the ExperienceItem.technologies list but won't contribute to the
        accumulated duration.

        Returns:
            Dict mapping canonical skill name → total effective years (float).
        """
        # skill_name -> list of (start, end) intervals
        skill_intervals: Dict[str, List[Tuple[date, date]]] = defaultdict(list)

        for item in experience_items:
            if not item.technologies:
                continue
            if item.start_date is None or item.end_date is None:
                logger.debug(
                    "Skipping duration for %d technologies in job '%s' — missing dates.",
                    len(item.technologies),
                    item.title or "unknown",
                )
                continue

            start = item.start_date
            end = item.end_date

            # Safety: swap if inverted (shouldn't happen, but defensive)
            if start > end:
                start, end = end, start

            for tech in item.technologies:
                skill_intervals[tech].append((start, end))

        # Merge overlapping intervals per skill and compute total years
        durations: Dict[str, float] = {}
        for skill, intervals in skill_intervals.items():
            merged = _merge_date_ranges(intervals)
            total_days = sum((e - s).days for s, e in merged)
            years = round(total_days / 365.25, 2)
            if years > 0:
                durations[skill] = years

        if durations:
            logger.info(
                "Skill durations computed for %d technologies (top 5: %s).",
                len(durations),
                ", ".join(f"{k}={v}y" for k, v in sorted(durations.items(), key=lambda x: -x[1])[:5]),
            )

        return durations

    # ------------------------------------------------------------------
    # Phase 4: Career Health Analysis (Red Flags & Gaps)
    # ------------------------------------------------------------------

    # Strong action verbs that indicate leadership, ownership, and impact
    _ACTION_VERBS = {
        # Leadership
        "led", "managed", "directed", "oversaw", "spearheaded", "mentored",
        "supervised", "coordinated", "facilitated", "orchestrated",
        # Technical ownership
        "developed", "engineered", "architected", "designed", "built",
        "implemented", "optimized", "automated", "refactored", "scaled",
        # Impact
        "launched", "delivered", "increased", "reduced", "improved",
        "streamlined", "transformed", "migrated", "pioneered", "resolved",
        # Analysis
        "analyzed", "evaluated", "assessed", "audited", "investigated",
    }

    def analyze_career_health(
        self,
        experience_items: List[ExperienceItem],
    ) -> Dict[str, List[str]]:
        """
        Analyze career trajectory for red flags and gaps.

        Detects:
        - **Employment gaps** longer than 6 months between consecutive jobs
          (excludes the current gap from last job to today if < 6 months).
        - **Suspicious overlaps** where two jobs overlap by > 90 days
          (potential data-entry errors or unclear tenure).
        - **Job hopping** if 3+ roles lasted < 1 year within the last 5 years.

        Returns:
            Dict with keys: "gaps", "overlaps", "red_flags".
            Each value is a list of human-readable, frontend-friendly strings.
        """
        gaps: List[str] = []
        overlaps: List[str] = []
        red_flags: List[str] = []

        # Filter to items with valid date ranges, sorted chronologically
        dated_items = [
            item for item in experience_items
            if item.start_date is not None and item.end_date is not None
        ]
        if not dated_items:
            return {"gaps": gaps, "overlaps": overlaps, "red_flags": red_flags}

        sorted_items = sorted(dated_items, key=lambda x: x.start_date)  # type: ignore[arg-type]
        today = date.today()

        # --- Gap Detection ---
        for i in range(len(sorted_items) - 1):
            current_end = sorted_items[i].end_date
            next_start = sorted_items[i + 1].start_date
            assert current_end is not None and next_start is not None

            gap_days = (next_start - current_end).days
            if gap_days > 180:  # > 6 months
                gap_months = round(gap_days / 30.44)
                gap_years = round(gap_days / 365.25, 1)
                label = f"{gap_years} years" if gap_years >= 1.0 else f"{gap_months} months"
                current_title = sorted_items[i].title or "Previous Role"
                next_title = sorted_items[i + 1].title or "Next Role"
                gaps.append(
                    f"Employment gap of {label} detected between "
                    f"'{current_title}' (ended {current_end.isoformat()}) and "
                    f"'{next_title}' (started {next_start.isoformat()})."
                )

        # Check gap from most recent job to today — only flag if > 6 months
        last_end = sorted_items[-1].end_date
        assert last_end is not None
        days_since_last = (today - last_end).days
        if days_since_last > 180:
            months_since = round(days_since_last / 30.44)
            last_title = sorted_items[-1].title or "Last Role"
            gaps.append(
                f"Currently unemployed for ~{months_since} months since "
                f"'{last_title}' ended on {last_end.isoformat()}."
            )

        # --- Overlap Detection ---
        for i in range(len(sorted_items) - 1):
            for j in range(i + 1, len(sorted_items)):
                a_start = sorted_items[i].start_date
                a_end = sorted_items[i].end_date
                b_start = sorted_items[j].start_date
                b_end = sorted_items[j].end_date
                assert a_start and a_end and b_start and b_end

                overlap_start = max(a_start, b_start)
                overlap_end = min(a_end, b_end)
                overlap_days = (overlap_end - overlap_start).days

                if overlap_days > 90:  # > 3 months
                    overlap_months = round(overlap_days / 30.44)
                    title_a = sorted_items[i].title or "Role A"
                    title_b = sorted_items[j].title or "Role B"
                    overlaps.append(
                        f"Roles '{title_a}' and '{title_b}' overlap by "
                        f"~{overlap_months} months. If these were not "
                        f"simultaneous positions, dates may need correction."
                    )

        # --- Job Hopping Detection ---
        five_years_ago = date(today.year - 5, today.month, today.day)
        recent_short_stints = 0
        for item in sorted_items:
            assert item.start_date is not None and item.end_date is not None
            if item.end_date < five_years_ago:
                continue
            duration_days = (item.end_date - item.start_date).days
            if duration_days < 365:
                recent_short_stints += 1

        if recent_short_stints >= 3:
            red_flags.append(
                f"Potential job hopping: {recent_short_stints} roles lasted less "
                f"than 1 year within the last 5 years. Consider explaining "
                f"short tenures in a cover letter."
            )

        if gaps:
            logger.info("Career health: %d gap(s) detected.", len(gaps))
        if overlaps:
            logger.info("Career health: %d overlap(s) detected.", len(overlaps))
        if red_flags:
            logger.info("Career health: %d red flag(s) detected.", len(red_flags))

        return {"gaps": gaps, "overlaps": overlaps, "red_flags": red_flags}

    def calculate_action_verb_score(
        self,
        experience_items: List[ExperienceItem],
    ) -> float:
        """
        Compute a normalized score (0.0 – 1.0) reflecting how effectively
        the candidate uses strong action verbs in their job descriptions.

        Scoring:
        - Count unique action verbs found across all description bullets.
        - Normalize against a target of 10 unique verbs (i.e., 10+ → 1.0).

        Returns:
            float in [0.0, 1.0].
        """
        if not experience_items:
            return 0.0

        found_verbs: set = set()
        total_bullets = 0

        for item in experience_items:
            for bullet in item.description:
                total_bullets += 1
                words = {w.lower().strip(".,;:()") for w in bullet.split()}
                found_verbs.update(words & self._ACTION_VERBS)

        if total_bullets == 0:
            return 0.0

        # Normalize: 10+ unique action verbs = perfect score
        score = min(1.0, len(found_verbs) / 10.0)

        logger.debug(
            "Action verb score: %.2f (%d unique verbs in %d bullets).",
            score,
            len(found_verbs),
            total_bullets,
        )
        return round(score, 2)

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

