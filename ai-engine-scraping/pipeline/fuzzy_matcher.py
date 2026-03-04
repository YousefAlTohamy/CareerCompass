"""
pipeline/fuzzy_matcher.py
==========================
Phase 3 — Fuzzy String Matching via Dynamic Programming

Implements the Levenshtein edit-distance algorithm using a classic 2-D
DP matrix — no external libraries (nltk, rapidfuzz, etc.) are used.

CS Background
-------------
The **Levenshtein Distance** (Vladimir Levenshtein, 1965) is the minimum
number of single-character edits (insertions, deletions, substitutions)
required to transform one string into another.

Dynamic Programming recurrence
--------------------------------
Let dp[i][j] = edit distance between s1[:i] and s2[:j].

Base cases:
    dp[i][0] = i   (delete all i chars from s1)
    dp[0][j] = j   (insert all j chars into s1)

Recurrence (i ≥ 1, j ≥ 1):
    if s1[i-1] == s2[j-1]:
        dp[i][j] = dp[i-1][j-1]          # no edit needed
    else:
        dp[i][j] = 1 + min(
            dp[i-1][j],                   # deletion
            dp[i][j-1],                   # insertion
            dp[i-1][j-1],                 # substitution
        )

Answer: dp[len(s1)][len(s2)]

Time  complexity: O(m × n)
Space complexity: O(m × n) — can be reduced to O(min(m,n)) with rolling rows
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def levenshtein_distance(s1: str, s2: str) -> int:
    """
    Calculate the Levenshtein (edit) distance between two strings.

    Uses a full 2-D DP matrix for clarity and correctness.
    No external packages are used.

    Parameters
    ----------
    s1 : str
        First input string.
    s2 : str
        Second input string.

    Returns
    -------
    int
        The minimum number of single-character edits (insert, delete,
        substitute) needed to transform ``s1`` into ``s2``.

    Examples
    --------
    >>> levenshtein_distance("kitten", "sitting")
    3
    >>> levenshtein_distance("React.js", "ReactJS")
    3
    >>> levenshtein_distance("", "abc")
    3
    >>> levenshtein_distance("abc", "abc")
    0
    """
    m, n = len(s1), len(s2)

    # Early-exit optimisations
    if s1 == s2:
        return 0
    if m == 0:
        return n
    if n == 0:
        return m

    # Allocate (m+1) × (n+1) DP matrix
    # dp[i][j] = edit distance between s1[:i] and s2[:j]
    dp: list[list[int]] = [[0] * (n + 1) for _ in range(m + 1)]

    # Base cases
    for i in range(m + 1):
        dp[i][0] = i   # cost of deleting i chars from s1
    for j in range(n + 1):
        dp[0][j] = j   # cost of inserting j chars into s1

    # Fill the matrix row by row (top-to-bottom, left-to-right)
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if s1[i - 1] == s2[j - 1]:
                # Characters match — no edit required
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(
                    dp[i - 1][j],       # deletion  (remove char from s1)
                    dp[i][j - 1],       # insertion (insert char into s1)
                    dp[i - 1][j - 1],   # substitution
                )

    distance = dp[m][n]
    logger.debug(
        "[FuzzyMatcher] levenshtein('%s', '%s') = %d", s1, s2, distance
    )
    return distance


def similarity_score(s1: str, s2: str) -> float:
    """
    Compute a normalised similarity score in [0.0, 1.0] between two strings.

    Formula::

        similarity = 1.0 - (levenshtein_distance(s1, s2) / max(len(s1), len(s2)))

    A score of **1.0** means the strings are identical.
    A score of **0.0** means they share no characters in common.

    Parameters
    ----------
    s1 : str
        First input string.
    s2 : str
        Second input string.

    Returns
    -------
    float
        Similarity score in [0.0, 1.0].

    Examples
    --------
    >>> similarity_score("React.js", "ReactJS")
    0.625
    >>> similarity_score("Python", "Python")
    1.0
    """
    if not s1 and not s2:
        return 1.0
    max_len = max(len(s1), len(s2))
    if max_len == 0:
        return 1.0
    distance = levenshtein_distance(s1, s2)
    score = 1.0 - distance / max_len
    logger.debug(
        "[FuzzyMatcher] similarity('%s', '%s') = %.4f (dist=%d, max_len=%d)",
        s1, s2, score, distance, max_len,
    )
    return score


def are_skills_similar(
    skill1: str,
    skill2: str,
    threshold: float = 0.8,
) -> bool:
    """
    Determine whether two skill strings are semantically similar enough
    to be considered the same skill.

    Algorithm
    ---------
    1. Normalise both strings (lowercase, strip whitespace).
    2. Compute ``similarity_score`` via Levenshtein DP.
    3. Return ``True`` if the score ≥ ``threshold``.

    Parameters
    ----------
    skill1 : str
        First skill name (e.g. ``"React.js"``).
    skill2 : str
        Second skill name (e.g. ``"ReactJS"``).
    threshold : float, optional
        Minimum similarity score to consider skills equivalent.
        Defaults to 0.8 (80 % similarity).

    Returns
    -------
    bool
        ``True`` if the skills are similar enough; ``False`` otherwise.

    Examples
    --------
    >>> are_skills_similar("React.js", "ReactJS")
    True
    >>> are_skills_similar("Python", "Java")
    False
    >>> are_skills_similar("PostgreSQL", "MySQL")
    False
    """
    if not (0.0 <= threshold <= 1.0):
        raise ValueError("threshold must be between 0.0 and 1.0.")

    s1 = skill1.strip().lower()
    s2 = skill2.strip().lower()

    if s1 == s2:
        logger.debug("[FuzzyMatcher] are_skills_similar: exact match '%s' == '%s'", s1, s2)
        return True

    score = similarity_score(s1, s2)
    result = score >= threshold

    logger.info(
        "[FuzzyMatcher] are_skills_similar('%s', '%s') score=%.4f threshold=%.2f → %s",
        skill1, skill2, score, threshold, result,
    )
    return result
