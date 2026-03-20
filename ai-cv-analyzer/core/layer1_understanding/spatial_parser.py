from __future__ import annotations

import io
import logging
from dataclasses import dataclass
from statistics import median
from typing import Iterable, List, Literal, Optional, Sequence, Tuple

import pdfplumber

logger = logging.getLogger(__name__)


SpatialExtractionStatus = Literal["ok", "no_text", "error"]


@dataclass(frozen=True, slots=True)
class SpatialTextExtraction:
    status: SpatialExtractionStatus
    text: Optional[str]
    page_count: int
    word_count: int

    def iter_lines(self) -> Iterable[str]:
        if not self.text:
            return iter(())
        return iter(self.text.splitlines())


@dataclass(frozen=True, slots=True)
class _Word:
    text: str
    x0: float
    x1: float
    top: float
    bottom: float

    @property
    def height(self) -> float:
        return max(0.0, self.bottom - self.top)


@dataclass(frozen=True, slots=True)
class _Segment:
    """
    A segment is a contiguous run of words inside a single visual row,
    split using large whitespace gaps (often indicating multi-column separation).
    """

    text: str
    x0: float
    x1: float
    top: float
    bottom: float

    @property
    def center_y(self) -> float:
        return (self.top + self.bottom) / 2.0


def extract_spatial_text_from_pdf(
    file_bytes: bytes,
    *,
    row_y_tolerance: Optional[float] = None,
    column_gap_ratio: float = 0.08,
    column_cluster_ratio: float = 0.12,
) -> SpatialTextExtraction:
    """
    Extracts text using spatial ordering to avoid multi-column reading issues.

    SRP: This module ONLY extracts and orders text using PDF coordinates.
    It does not do NER, regex cleaning, or semantic post-processing.
    """
    if not file_bytes:
        return SpatialTextExtraction(status="no_text", text=None, page_count=0, word_count=0)

    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            page_text_parts: List[str] = []
            total_words = 0

            for page in pdf.pages:
                words = _extract_words(page)
                if not words:
                    continue

                total_words += len(words)
                page_width = float(getattr(page, "width", 0.0) or 0.0)
                y_tol = row_y_tolerance if row_y_tolerance is not None else _auto_row_tolerance(words)
                gap_threshold = max(20.0, page_width * column_gap_ratio) if page_width > 0 else 40.0
                cluster_threshold = max(30.0, page_width * column_cluster_ratio) if page_width > 0 else 80.0

                rows = _group_words_into_rows(words, y_tol)
                segments = _split_rows_into_segments(rows, gap_threshold)
                ordered_lines = _order_segments_by_columns_then_rows(segments, cluster_threshold)

                page_text_parts.append("\n".join(ordered_lines).strip())

            full_text = "\n\n".join([p for p in page_text_parts if p]).strip()
            if not full_text:
                logger.info("Spatial extractor found no text blocks. Likely scanned PDF.")
                return SpatialTextExtraction(
                    status="no_text", text=None, page_count=len(pdf.pages), word_count=0
                )

            return SpatialTextExtraction(
                status="ok", text=full_text, page_count=len(pdf.pages), word_count=total_words
            )

    except pdfplumber.pdf.PDFSyntaxError as e:
        logger.error("Invalid PDF syntax for spatial extraction: %s", e)
        return SpatialTextExtraction(status="error", text=None, page_count=0, word_count=0)
    except Exception as e:
        logger.exception("Spatial extraction failed: %s", e)
        return SpatialTextExtraction(status="error", text=None, page_count=0, word_count=0)


def extract_ordered_text_from_pdf(file_bytes: bytes) -> Optional[str]:
    """
    Convenience wrapper for downstream layers that only need plain text.
    """
    result = extract_spatial_text_from_pdf(file_bytes)
    return result.text if result.status == "ok" else None


def _extract_words(page) -> List[_Word]:
    raw_words = page.extract_words(
        keep_blank_chars=False,
        use_text_flow=False,
        extra_attrs=[],
    )
    words: List[_Word] = []
    for w in raw_words or []:
        text = (w.get("text") or "").strip()
        if not text:
            continue
        try:
            words.append(
                _Word(
                    text=text,
                    x0=float(w["x0"]),
                    x1=float(w["x1"]),
                    top=float(w["top"]),
                    bottom=float(w["bottom"]),
                )
            )
        except Exception:
            # Skip malformed word blocks while keeping extraction resilient
            continue
    return words


def _auto_row_tolerance(words: Sequence[_Word]) -> float:
    heights = [w.height for w in words if w.height > 0.0]
    if not heights:
        return 3.0
    # Using a fraction of the median word height stabilizes across fonts/sizes.
    return max(2.5, float(median(heights)) * 0.65)


def _group_words_into_rows(words: Sequence[_Word], y_tolerance: float) -> List[List[_Word]]:
    """
    Row Grouper (Y-first, then X):
    - Sort all words by visual Y (top), then X.
    - Cluster into rows by Y proximity (within y_tolerance).
    """
    ordered = sorted(words, key=lambda w: (w.top, w.x0))
    rows: List[List[_Word]] = []
    current: List[_Word] = []
    current_y: Optional[float] = None

    for w in ordered:
        if not current:
            current = [w]
            current_y = w.top
            continue

        assert current_y is not None
        if abs(w.top - current_y) <= y_tolerance:
            current.append(w)
            # Update row anchor towards current word to reduce drift on noisy PDFs
            current_y = (current_y * 0.8) + (w.top * 0.2)
        else:
            rows.append(sorted(current, key=lambda x: x.x0))
            current = [w]
            current_y = w.top

    if current:
        rows.append(sorted(current, key=lambda x: x.x0))

    return rows


def _split_rows_into_segments(rows: Sequence[Sequence[_Word]], gap_threshold: float) -> List[_Segment]:
    """
    Splits a visual row into segments using large horizontal gaps.
    This prevents "row-wise" reading from accidentally merging left/right columns.
    """
    segments: List[_Segment] = []

    for row in rows:
        if not row:
            continue

        buf: List[_Word] = []
        for w in row:
            if not buf:
                buf = [w]
                continue

            prev = buf[-1]
            gap = w.x0 - prev.x1
            if gap > gap_threshold:
                segments.append(_segment_from_words(buf))
                buf = [w]
            else:
                buf.append(w)

        if buf:
            segments.append(_segment_from_words(buf))

    return segments


def _segment_from_words(words: Sequence[_Word]) -> _Segment:
    text = " ".join(w.text for w in words).strip()
    return _Segment(
        text=text,
        x0=min(w.x0 for w in words),
        x1=max(w.x1 for w in words),
        top=min(w.top for w in words),
        bottom=max(w.bottom for w in words),
    )


def _order_segments_by_columns_then_rows(
    segments: Sequence[_Segment],
    cluster_threshold: float,
) -> List[str]:
    """
    Column-aware ordering:
    - Cluster segments into columns by X proximity (greedy 1D clustering on x0).
    - Read columns left-to-right; within each column read top-to-bottom.
    """
    if not segments:
        return []

    sorted_segs = sorted(segments, key=lambda s: (s.x0, s.center_y))
    columns: List[Tuple[float, List[_Segment]]] = []  # (x_centroid, segments)

    for seg in sorted_segs:
        best_idx = -1
        best_dist = float("inf")
        for i, (cx, _) in enumerate(columns):
            dist = abs(seg.x0 - cx)
            if dist < best_dist:
                best_dist = dist
                best_idx = i

        if best_idx >= 0 and best_dist <= cluster_threshold:
            cx, col = columns[best_idx]
            col.append(seg)
            # Incremental centroid update
            new_cx = (cx * 0.85) + (seg.x0 * 0.15)
            columns[best_idx] = (new_cx, col)
        else:
            columns.append((seg.x0, [seg]))

    columns.sort(key=lambda c: c[0])

    lines: List[str] = []
    for _, col_segments in columns:
        col_segments_sorted = sorted(col_segments, key=lambda s: (s.center_y, s.x0))
        for seg in col_segments_sorted:
            if seg.text:
                lines.append(seg.text)

        # Separate columns (keeps readability and reduces accidental merges)
        if lines and lines[-1] != "":
            lines.append("")

    # Trim trailing blank
    while lines and lines[-1] == "":
        lines.pop()
    return lines

