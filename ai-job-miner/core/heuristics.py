"""
core/heuristics.py
===================
Phase 2 — Smart DOM Analysis Algorithms

Implements three pure CS algorithms that allow the scraper to extract
structured data from arbitrary HTML pages WITHOUT relying on brittle
CSS class names, IDs, or XPath selectors.

Algorithms
----------
1. **Text Density**  (`get_text_density`)
   A per-node score that rewards nodes with a lot of clean text relative
   to the amount of child markup they contain.  High-density nodes are
   almost always the main content block on the page.

   Formula:  density = len(stripped_text) / (num_child_tags + 1)

2. **DFS Density Traversal**  (`find_highest_density_node`)
   A Depth-First Search over the DOM tree that evaluates text density
   for every <div>, <section>, and <article> node, then returns the
   globally highest-scoring node.  This reliably identifies the "job
   description" block regardless of its CSS class or nesting depth.

3. **Semantic Proximity**  (`extract_semantic_sibling`)
   Locates a keyword (e.g. "salary", "pay") anywhere in the tree using
   a case-insensitive text search, then walks the immediately adjacent
   sibling/parent nodes to find the first non-empty text node — the
   "value" that semantically belongs to that label.

4. **Job Title Validator**  (`is_likely_job_title`)
   Heuristic filter that rejects search-summary strings (e.g.
   "4,178,000+ jobs in United States") and validates that a candidate
   string has the structural characteristics of a real job title.

5. **Job Container Detector**  (`find_job_containers`)
   Identifies repeating elements within list structures (ul/ol, tables,
   repeated sibling divs) that are likely individual job cards, while
   ignoring singleton header/summary elements.

References / CS Background
--------------------------
* DFS on trees: Cormen et al., "Introduction to Algorithms", §22.3
* Text-density content extraction: Kohlschütter et al., "Boilerplate
  Detection Using Shallow Text Features" (WWW 2010)
"""

from __future__ import annotations

import logging
import re
from typing import Optional

from bs4 import BeautifulSoup, NavigableString, Tag

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Node types we consider as potential "main content" containers
_CONTENT_TAGS: frozenset[str] = frozenset({"div", "section", "article", "main"})

# Minimum character count for a node to be considered a description block
_MIN_DESCRIPTION_LENGTH: int = 200

# Tags that are pure navigation / chrome — excluded from density scoring
_NOISE_TAGS: frozenset[str] = frozenset(
    {"script", "style", "noscript", "head", "meta", "link", "nav", "footer", "header"}
)

# ---------------------------------------------------------------------------
# Job Title Validation — Negative Keyword Patterns
# ---------------------------------------------------------------------------

# Compiled regex patterns that indicate a string is a search-summary or
# page-level metadata rather than an individual job title.
_NEGATIVE_TITLE_PATTERNS: list[re.Pattern[str]] = [
    # "4,178,000+ jobs", "1,200 Jobs", "500+ Results"
    re.compile(r"\d{1,3}(?:,\d{3})*\+?\s*(?:jobs?|results?|positions?|openings?|vacancies)", re.IGNORECASE),
    # "Results for …"
    re.compile(r"\bresults?\s+for\b", re.IGNORECASE),
    # "Showing 1-25 of 500", "Showing 1 – 10"
    re.compile(r"\bshowing\s+\d+\s*[-–—]\s*\d+", re.IGNORECASE),
    # "Page 1 of 50"
    re.compile(r"\bpage\s+\d+\s+of\s+\d+", re.IGNORECASE),
    # "Jobs in New York", "Jobs in United States", "Jobs near …"
    re.compile(r"\bjobs?\s+(?:in|near|around|within)\s+[A-Z]", re.IGNORECASE),
    # "Search results", "Search jobs"
    re.compile(r"\bsearch\s+(?:results?|jobs?|positions?)\b", re.IGNORECASE),
    # "Found 500 jobs", "We found 1,200 results"
    re.compile(r"\bfound\s+\d", re.IGNORECASE),
    # "Browse 300+ jobs"
    re.compile(r"\bbrowse\s+\d", re.IGNORECASE),
    # "Explore jobs", "Explore careers"
    re.compile(r"\bexplore\s+(?:jobs?|careers?|opportunities)\b", re.IGNORECASE),
    # "Filter by …", "Sort by …"
    re.compile(r"\b(?:filter|sort|refine)\s+by\b", re.IGNORECASE),
    # "All jobs", "All openings"
    re.compile(r"\ball\s+(?:jobs?|openings?|positions?)\b", re.IGNORECASE),
]

# Ideal word-count range for a real job title
_TITLE_MIN_WORDS: int = 2
_TITLE_MAX_WORDS: int = 8
_TITLE_HARD_MAX_WORDS: int = 12

# Tags whose ancestor presence should disqualify a title candidate
_SUMMARY_ANCESTOR_TAGS: frozenset[str] = frozenset({"header", "nav", "footer"})

# CSS class name fragments that suggest a search-summary container
_SUMMARY_CLASS_FRAGMENTS: list[str] = [
    "search-result-summary", "result-summary", "search-summary",
    "results-header", "search-header", "jobs-count", "result-count",
    "search-count", "total-results", "job-count", "pagination",
    "breadcrumb", "filter", "sort-bar", "toolbar",
]


# ===========================================================================
# Algorithm 1 — Text Density
# ===========================================================================

def get_text_density(node: Tag) -> float:
    """
    Calculate the *text density* of a BeautifulSoup ``Tag`` node.

    Text density is a measure of how much meaningful textual content a
    node carries per unit of markup complexity.  Nodes with lots of text
    and few child tags (e.g. a long <div> holding a job description) score
    very high.  Nodes that are mostly markup with little visible text
    (e.g. a navigation bar full of <a> tags) score near zero.

    Formula
    -------
    ::

        density = len(stripped_text) / (num_direct_child_tags + 1)

    The ``+ 1`` in the denominator prevents division-by-zero for leaf nodes
    that have no child tags.

    Parameters
    ----------
    node : bs4.element.Tag
        Any BeautifulSoup ``Tag`` object.

    Returns
    -------
    float
        A non-negative density score.  Higher → richer in text content.
    """
    # Collapse all whitespace so we measure meaningful characters only
    stripped_text = re.sub(r"\s+", " ", node.get_text(separator=" ")).strip()
    text_length = len(stripped_text)

    # Count only direct child *tags* (not NavigableString children)
    num_child_tags = sum(1 for child in node.children if isinstance(child, Tag))

    density = text_length / (num_child_tags + 1)
    return density


# ===========================================================================
# Algorithm 2 — DFS Traversal for Highest-Density Node
# ===========================================================================

def find_highest_density_node(
    soup: BeautifulSoup,
    min_length: int = _MIN_DESCRIPTION_LENGTH,
) -> Optional[str]:
    """
    Perform a Depth-First Search over the DOM tree to find the node that
    most likely contains the main job description.

    The algorithm:
    1. Iterates all ``<div>``, ``<section>``, ``<article>``, and ``<main>``
       nodes in DFS order (BeautifulSoup's ``find_all`` is inherently DFS).
    2. Skips nodes inside ``<script>``, ``<style>``, ``<nav>``, etc.
    3. Skips nodes whose clean text is shorter than ``min_length``.
    4. Calculates ``get_text_density`` for each candidate.
    5. Returns the **clean text** of the absolute highest-scoring node.

    Time complexity: O(n) where n is the number of DOM nodes — each node
    is visited exactly once.

    Why this works
    --------------
    A job description is typically a single large prose block.  Its parent
    container has high text density because it holds many characters but
    few structural child tags.  Navigation bars, sidebars, and footers have
    *many* child tags (links, icons, buttons) but comparatively little
    actual text, so they score low.

    Parameters
    ----------
    soup : bs4.BeautifulSoup
        A fully-parsed BeautifulSoup document tree.
    min_length : int, optional
        Minimum character threshold for a node to be considered.
        Defaults to 200.

    Returns
    -------
    str or None
        The clean text of the best-matching node, or ``None`` if no node
        meets the threshold.
    """
    best_node: Optional[Tag] = None
    best_score: float = -1.0

    # find_all traverses the tree in document order (DFS)
    for node in soup.find_all(_CONTENT_TAGS):
        # Skip nodes that live inside noisy / non-content parents
        if any(parent.name in _NOISE_TAGS for parent in node.parents):
            continue

        raw_text = re.sub(r"\s+", " ", node.get_text(separator=" ")).strip()

        if len(raw_text) < min_length:
            continue

        score = get_text_density(node)
        logger.debug(
            "[Heuristics] Node <%s class='%s'> — density=%.2f, len=%d",
            node.name,
            node.get("class", ""),
            score,
            len(raw_text),
        )

        if score > best_score:
            best_score = score
            best_node = node

    if best_node is None:
        logger.warning("[Heuristics] find_highest_density_node: no qualifying node found.")
        return None

    result_text = re.sub(r"\s+", " ", best_node.get_text(separator=" ")).strip()
    logger.info(
        "[Heuristics] Best density node: <%s class='%s'> score=%.2f len=%d",
        best_node.name,
        best_node.get("class", ""),
        best_score,
        len(result_text),
    )
    return result_text


# ===========================================================================
# Algorithm 3 — Semantic Proximity / Sibling Walk
# ===========================================================================

def extract_semantic_sibling(
    soup: BeautifulSoup,
    keyword: str,
    max_sibling_hops: int = 5,
) -> Optional[str]:
    """
    Locate a label keyword in the DOM and return the semantically adjacent
    value — the text node that "answers" the label.

    Algorithm (Semantic Proximity)
    --------------------------------
    1. Search the entire tree for any ``NavigableString`` or tag whose
       *text content* contains ``keyword`` (case-insensitive).
    2. From that anchor node, walk **next siblings** up to
       ``max_sibling_hops`` steps, returning the first non-empty text.
    3. If no non-empty sibling is found, walk up to the **parent** and
       try the parent's own siblings in the same way.
    4. Return ``None`` if the keyword is absent or no value is found.

    Why no hardcoded selectors?
    ---------------------------
    Salary information appears in dozens of HTML patterns across different
    job boards:

    * ``<span>Salary:</span><strong>$80k</strong>``  — adjacent siblings
    * ``<li>Pay: $80k–$100k</li>``                   — inline in same node
    * ``<dt>Compensation</dt><dd>$80k</dd>``         — definition list
    * ``<td>Base Pay</td><td>$80k</td>``             — table cells

    By walking siblings algorithmically, we handle all patterns without
    knowing which one the target page uses.

    Parameters
    ----------
    soup : bs4.BeautifulSoup
        A fully-parsed BeautifulSoup document tree.
    keyword : str
        The label to search for (e.g. ``"Salary"``, ``"Pay"``,
        ``"Compensation"``).  Matching is case-insensitive.
    max_sibling_hops : int, optional
        Maximum number of next-sibling steps before giving up.
        Defaults to 5.

    Returns
    -------
    str or None
        The extracted value text, stripped of surrounding whitespace,
        or ``None`` if nothing was found.
    """
    keyword_lower = keyword.strip().lower()
    logger.info("[Heuristics] Searching for semantic keyword: '%s'", keyword)

    # -----------------------------------------------------------------------
    # Helper: find the first non-empty text among next siblings.
    # Uses node.next_siblings (yields both Tag AND NavigableString objects)
    # rather than find_next_sibling() which skips NavigableStrings.
    # -----------------------------------------------------------------------
    def _walk_next_siblings(node: Tag, hops: int) -> Optional[str]:
        count = 0
        for sibling in node.next_siblings:
            if count >= hops:
                break
            if isinstance(sibling, NavigableString):
                text = sibling.strip()
                if text:
                    return text
            elif isinstance(sibling, Tag):
                text = re.sub(r"\s+", " ", sibling.get_text(separator=" ")).strip()
                if text:
                    return text
            count += 1
        return None

    # -----------------------------------------------------------------------
    # 1. Search for any tag whose text contains the keyword.
    #    We collect ALL matches and pick the SHORTEST one (most leaf-like)
    #    to avoid accidentally selecting a large parent container that
    #    incidentally contains the keyword deep in its subtree.
    # -----------------------------------------------------------------------
    def _contains_keyword(tag: Tag) -> bool:
        return (
            isinstance(tag, Tag)
            and keyword_lower in tag.get_text().lower()
        )

    all_matches = soup.find_all(_contains_keyword)

    # Pick the match with the shortest text (most specific label node)
    anchor_tag: Optional[Tag] = None
    if all_matches:
        anchor_tag = min(all_matches, key=lambda t: len(t.get_text().strip()))

    if anchor_tag is None:
        # Fallback: search raw NavigableStrings
        for string in soup.strings:
            if keyword_lower in string.lower():
                parent = string.parent
                if parent and isinstance(parent, Tag):
                    anchor_tag = parent
                    break

    if anchor_tag is None:
        logger.warning("[Heuristics] Keyword '%s' not found in document.", keyword)
        return None

    logger.debug(
        "[Heuristics] Anchor found: <%s> text='%s'",
        anchor_tag.name,
        anchor_tag.get_text().strip()[:60],
    )

    # -----------------------------------------------------------------------
    # 2. Walk next siblings of the anchor tag
    # -----------------------------------------------------------------------
    value = _walk_next_siblings(anchor_tag, max_sibling_hops)
    if value:
        logger.info("[Heuristics] Salary via sibling walk: '%s'", value)
        return value

    # -----------------------------------------------------------------------
    # 3. Fallback: check if the keyword and value are INLINE in the same node
    #    e.g. <li>Salary: $80k - $100k</li>
    # -----------------------------------------------------------------------
    full_text = re.sub(r"\s+", " ", anchor_tag.get_text(separator=" ")).strip()
    # Strip the keyword prefix and return whatever remains
    pattern = re.compile(re.escape(keyword), re.IGNORECASE)
    remainder = pattern.sub("", full_text).lstrip(": –-—").strip()
    if remainder:
        logger.info("[Heuristics] Salary extracted inline: '%s'", remainder)
        return remainder

    # -----------------------------------------------------------------------
    # 4. Fallback: walk siblings of the *parent* node
    # -----------------------------------------------------------------------
    if anchor_tag.parent and isinstance(anchor_tag.parent, Tag):
        value = _walk_next_siblings(anchor_tag.parent, max_sibling_hops)
        if value:
            logger.info("[Heuristics] Salary via parent-sibling walk: '%s'", value)
            return value

    logger.warning(
        "[Heuristics] Could not extract value for keyword '%s'.", keyword
    )
    return None


# ===========================================================================
# Algorithm 4 — Job Title Validator
# ===========================================================================

def is_likely_job_title(text: str) -> bool:
    """
    Determine whether a candidate string looks like a genuine job title
    rather than a search-summary element, page header, or metadata noise.

    The validator applies three layers of filtering:

    1. **Negative keyword rejection** — compiled regex patterns that match
       search-result counters (``"4,178,000+ jobs"``), pagination strings
       (``"Showing 1-25 of 500"``), and other page-level metadata.
    2. **Word-count constraints** — real job titles are typically 2–8 words.
       Strings shorter than 2 words or longer than 12 words are rejected.
       Strings between 9 and 12 words receive a warning but are allowed
       (some legitimate titles are verbose).
    3. **Structural sanity checks** — reject strings that are pure digits,
       URLs, or contain excessive punctuation.

    Parameters
    ----------
    text : str
        The candidate job title string (already stripped/cleaned).

    Returns
    -------
    bool
        ``True`` if the string passes all heuristic filters and is likely
        a genuine job title.  ``False`` otherwise.
    """
    if not text or not text.strip():
        logger.debug("[Heuristics] is_likely_job_title: empty string rejected.")
        return False

    cleaned = re.sub(r"\s+", " ", text).strip()

    # ── Layer 1: Negative keyword patterns ──────────────────────────────
    for pattern in _NEGATIVE_TITLE_PATTERNS:
        if pattern.search(cleaned):
            logger.debug(
                "[Heuristics] is_likely_job_title: REJECTED by negative pattern "
                "'%s' → '%s'",
                pattern.pattern,
                cleaned[:80],
            )
            return False

    # ── Layer 2: Word-count constraints ─────────────────────────────────
    words = cleaned.split()
    word_count = len(words)

    if word_count < _TITLE_MIN_WORDS:
        logger.debug(
            "[Heuristics] is_likely_job_title: REJECTED — too few words (%d): '%s'",
            word_count,
            cleaned[:80],
        )
        return False

    if word_count > _TITLE_HARD_MAX_WORDS:
        logger.debug(
            "[Heuristics] is_likely_job_title: REJECTED — too many words (%d): '%s'",
            word_count,
            cleaned[:80],
        )
        return False

    if word_count > _TITLE_MAX_WORDS:
        logger.info(
            "[Heuristics] is_likely_job_title: WARNING — borderline word count "
            "(%d, max ideal=%d): '%s'",
            word_count,
            _TITLE_MAX_WORDS,
            cleaned[:80],
        )
        # Allow but flag — some real titles are verbose (e.g.
        # "Senior Staff Software Engineer, Infrastructure and Platform")

    # ── Layer 3: Structural sanity checks ───────────────────────────────

    # Reject if the string is purely numeric (e.g. "12345")
    if re.fullmatch(r"[\d\s,.\-+]+", cleaned):
        logger.debug(
            "[Heuristics] is_likely_job_title: REJECTED — purely numeric: '%s'",
            cleaned[:80],
        )
        return False

    # Reject if it looks like a URL
    if re.match(r"https?://", cleaned, re.IGNORECASE):
        logger.debug(
            "[Heuristics] is_likely_job_title: REJECTED — looks like URL: '%s'",
            cleaned[:80],
        )
        return False

    # Reject if excessive special characters (more than 30% non-alnum/space)
    alnum_count = sum(1 for c in cleaned if c.isalnum() or c.isspace())
    if len(cleaned) > 0 and alnum_count / len(cleaned) < 0.70:
        logger.debug(
            "[Heuristics] is_likely_job_title: REJECTED — excessive special chars: '%s'",
            cleaned[:80],
        )
        return False

    logger.debug(
        "[Heuristics] is_likely_job_title: ACCEPTED (%d words): '%s'",
        word_count,
        cleaned[:80],
    )
    return True


def is_search_summary_element(node: Tag) -> bool:
    """
    Determine whether a DOM node is part of a search-results summary area
    (e.g. result counts, pagination, breadcrumbs) rather than an individual
    job container.

    Checks
    ------
    1. The node or any of its ancestors is a ``<header>``, ``<nav>``, or
       ``<footer>`` tag.
    2. The node's CSS classes contain fragments associated with search
       summary containers (e.g. ``"results-header"``, ``"job-count"``).
    3. The node's visible text matches a negative keyword pattern.

    Parameters
    ----------
    node : bs4.element.Tag
        A BeautifulSoup ``Tag`` to evaluate.

    Returns
    -------
    bool
        ``True`` if the node looks like a summary element (should be ignored).
    """
    if not isinstance(node, Tag):
        return False

    # Check ancestor tags
    for parent in node.parents:
        if isinstance(parent, Tag) and parent.name in _SUMMARY_ANCESTOR_TAGS:
            logger.debug(
                "[Heuristics] is_search_summary_element: node inside <%s>, skipping.",
                parent.name,
            )
            return True

    # Check CSS classes for summary-related fragments
    classes = " ".join(node.get("class", [])).lower()
    for fragment in _SUMMARY_CLASS_FRAGMENTS:
        if fragment in classes:
            logger.debug(
                "[Heuristics] is_search_summary_element: CSS class match '%s'.",
                fragment,
            )
            return True

    # Check the node's ID attribute for summary-related fragments
    node_id = (node.get("id") or "").lower()
    for fragment in _SUMMARY_CLASS_FRAGMENTS:
        if fragment in node_id:
            logger.debug(
                "[Heuristics] is_search_summary_element: ID match '%s'.",
                fragment,
            )
            return True

    # Check if the node's text matches negative patterns
    node_text = re.sub(r"\s+", " ", node.get_text(separator=" ")).strip()
    if node_text and len(node_text) < 200:  # Only check short text nodes
        for pattern in _NEGATIVE_TITLE_PATTERNS:
            if pattern.search(node_text):
                logger.debug(
                    "[Heuristics] is_search_summary_element: text matches "
                    "negative pattern: '%s'",
                    node_text[:80],
                )
                return True

    return False


# ===========================================================================
# Algorithm 5 — Job Container Detector
# ===========================================================================

def find_job_containers(soup: BeautifulSoup, min_repeats: int = 3) -> list[Tag]:
    """
    Identify DOM nodes that are likely individual job-listing cards/rows
    by looking for **repeating sibling structures** within list containers.

    The algorithm favours elements that repeat within a parent container
    (the hallmark of a job listing page) over large singleton header
    elements that contain page-level summaries.

    Algorithm
    ---------
    1. Find all ``<ul>``, ``<ol>``, ``<table>``, ``<div>``, ``<section>``
       containers that have at least ``min_repeats`` direct children of
       the same tag type.
    2. Score each candidate group by:
       - **Repetition bonus** — more repeated siblings = higher score.
       - **Structural consistency** — children with similar child-tag
         counts and text lengths score higher.
       - **Summary penalty** — groups inside ``<header>``, ``<nav>``, or
         summary-class containers are penalized heavily.
       - **Singleton penalty** — groups with fewer than ``min_repeats``
         items are discarded.
    3. Return the child elements of the highest-scoring group.

    Parameters
    ----------
    soup : bs4.BeautifulSoup
        A fully-parsed BeautifulSoup document tree.
    min_repeats : int, optional
        Minimum number of repeated siblings required to consider a group.
        Defaults to 3.

    Returns
    -------
    list[Tag]
        A list of Tag nodes that are likely individual job containers.
        Empty list if no repeating structure is found.
    """
    candidate_parents: list[tuple[Tag, str, list[Tag], float]] = []

    # Tags that commonly serve as list containers on job boards
    container_tags = {"ul", "ol", "table", "tbody", "div", "section", "main"}

    for container in soup.find_all(container_tags):
        # Skip containers inside noise zones
        if any(
            isinstance(p, Tag) and p.name in _NOISE_TAGS
            for p in container.parents
        ):
            continue

        # Group direct children by tag name
        child_groups: dict[str, list[Tag]] = {}
        for child in container.children:
            if isinstance(child, Tag):
                child_groups.setdefault(child.name, []).append(child)

        for child_tag, children in child_groups.items():
            if len(children) < min_repeats:
                continue

            # ── Score this group ────────────────────────────────────────
            score = 0.0

            # Repetition bonus: more items → more likely a real listing
            score += len(children) * 10.0

            # Structural consistency bonus: children should have similar
            # internal structure (similar number of sub-tags and text length)
            child_tag_counts = [
                sum(1 for c in ch.children if isinstance(c, Tag))
                for ch in children
            ]
            child_text_lens = [
                len(re.sub(r"\s+", " ", ch.get_text(separator=" ")).strip())
                for ch in children
            ]

            if child_tag_counts:
                avg_tags = sum(child_tag_counts) / len(child_tag_counts)
                tag_variance = sum(
                    (c - avg_tags) ** 2 for c in child_tag_counts
                ) / len(child_tag_counts)
                # Low variance → high consistency → bonus
                if avg_tags > 0:
                    consistency = 1.0 / (1.0 + tag_variance / avg_tags)
                    score += consistency * 30.0

            if child_text_lens:
                avg_text = sum(child_text_lens) / len(child_text_lens)
                # Reject groups where children have very little text
                # (likely navigation links, not job cards)
                if avg_text < 15:
                    score -= 50.0
                elif avg_text > 30:
                    score += 20.0

            # Summary/noise penalty: container inside summary area
            if is_search_summary_element(container):
                score -= 200.0

            # Check if any children contain search summary text
            summary_children = sum(
                1 for ch in children if is_search_summary_element(ch)
            )
            if summary_children > len(children) * 0.5:
                score -= 150.0

            # Bonus for <li> children inside <ul>/<ol> (classic listing)
            if child_tag in ("li",) and container.name in ("ul", "ol"):
                score += 40.0

            # Bonus for <tr> children inside <table>/<tbody>
            if child_tag in ("tr",) and container.name in ("table", "tbody"):
                score += 30.0

            # Bonus for <a>-containing children (job cards usually link)
            link_children = sum(
                1 for ch in children if ch.find("a", href=True)
            )
            if link_children > len(children) * 0.5:
                score += 25.0

            logger.debug(
                "[Heuristics] find_job_containers: <%s> → %d × <%s> "
                "score=%.1f",
                container.name,
                len(children),
                child_tag,
                score,
            )

            if score > 0:
                candidate_parents.append(
                    (container, child_tag, children, score)
                )

    if not candidate_parents:
        logger.warning("[Heuristics] find_job_containers: no repeating structure found.")
        return []

    # Pick the highest-scoring group
    candidate_parents.sort(key=lambda x: x[3], reverse=True)
    best = candidate_parents[0]

    logger.info(
        "[Heuristics] find_job_containers: best group — <%s> with %d × <%s> "
        "(score=%.1f)",
        best[0].name,
        len(best[2]),
        best[1],
        best[3],
    )

    return best[2]
