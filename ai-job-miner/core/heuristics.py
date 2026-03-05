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
