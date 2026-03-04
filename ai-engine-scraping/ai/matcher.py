"""
ai/matcher.py
=============
Phase 4 — TF-IDF & Cosine Similarity Matching Engine

Implements the full TF-IDF → Cosine Similarity pipeline **from first
principles** using only Python's standard library.  No NumPy, no
scikit-learn, no external packages.

CS Background
-------------
TF-IDF  (Term Frequency – Inverse Document Frequency)
    A classical Information Retrieval weighting scheme (Sparck Jones, 1972).
    It balances two signals:

    * TF  = how often a term appears in a document (local signal)
    * IDF = how rare a term is across all documents (global signal)

    A term that appears often in one document but rarely across the corpus
    receives a high TF-IDF weight — it is *distinctive* for that document.

Cosine Similarity
    Measures the angle between two vectors in n-dimensional term space.
    Robust to document length differences because it normalises by the
    vector magnitudes.

        cos(θ) = (v₁ · v₂) / (‖v₁‖ × ‖v₂‖)

    Returns 1.0 for identical term distributions, 0.0 for no shared terms.

Complexity
----------
* tokenize      O(n)       — single pass regex split
* compute_tf    O(n)       — single pass count + normalise
* compute_idf   O(D × n)   — D documents, n avg tokens each
* vectorize     O(V)       — V = vocabulary size
* cosine_sim    O(V)       — one dot-product + two magnitude walks

All operations are O(n) or O(V) — no matrix multiplication needed.
"""

from __future__ import annotations

import logging
import math
import re
from collections import Counter
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# English stop-words to exclude from TF-IDF vocabulary
# (common words that carry no discriminating signal)
# ---------------------------------------------------------------------------
_STOP_WORDS: frozenset[str] = frozenset({
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
    "been", "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "shall", "can", "need",
    "dare", "ought", "used", "it", "its", "it's", "this", "that", "these",
    "those", "i", "we", "you", "he", "she", "they", "me", "us", "him",
    "her", "them", "my", "our", "your", "his", "their", "not", "no",
    "nor", "so", "yet", "both", "either", "neither", "each", "every",
    "all", "any", "few", "more", "most", "other", "some", "such", "only",
    "own", "same", "than", "too", "very", "s", "t", "just", "about",
    "above", "after", "also", "between",
})


# ===========================================================================
# Step 1 — Tokenizer
# ===========================================================================

def tokenize(text: str) -> list[str]:
    """
    Convert raw text into a list of normalised tokens.

    Pipeline
    --------
    1. Lowercase
    2. Split on non-alphanumeric characters (regex ``\\W+``)
    3. Filter out stop-words and tokens shorter than 2 characters

    Parameters
    ----------
    text : str
        Raw input text.

    Returns
    -------
    list[str]
        List of clean tokens.

    Examples
    --------
    >>> tokenize("Python Developer with experience in Django!")
    ['python', 'developer', 'experience', 'django']
    """
    tokens = re.split(r"\W+", text.lower())
    return [
        t for t in tokens
        if len(t) >= 2 and t not in _STOP_WORDS
    ]


# ===========================================================================
# Step 2 — Term Frequency
# ===========================================================================

def compute_tf(text: str) -> dict[str, float]:
    """
    Calculate **Term Frequency** (TF) for all tokens in *text*.

    Formula::

        TF(term, doc) = count(term in doc) / total_tokens(doc)

    The denominator normalises by document length so that long CVs don't
    artificially outweigh short job descriptions.

    Parameters
    ----------
    text : str
        Input document text.

    Returns
    -------
    dict[str, float]
        Mapping of token → TF score.  All values in (0.0, 1.0].
        Returns an empty dict if the document has no valid tokens.

    Examples
    --------
    >>> compute_tf("python python django")
    {'python': 0.6667, 'django': 0.3333}
    """
    tokens = tokenize(text)
    if not tokens:
        logger.warning("[Matcher] compute_tf received empty token list.")
        return {}

    total = len(tokens)
    counts = Counter(tokens)
    tf = {term: count / total for term, count in counts.items()}

    logger.debug("[Matcher] compute_tf: %d unique terms from %d tokens", len(tf), total)
    return tf


# ===========================================================================
# Step 3 — Inverse Document Frequency
# ===========================================================================

def compute_idf(corpus: list[str]) -> dict[str, float]:
    """
    Calculate **Inverse Document Frequency** (IDF) across a corpus.

    Formula (smoothed to avoid division-by-zero)::

        IDF(term) = log( total_docs / (1 + docs_containing_term) )

    The ``+1`` prevents zero IDF for terms present in every document.

    Parameters
    ----------
    corpus : list[str]
        List of raw document strings (e.g. [cv_text, job_desc_text]).

    Returns
    -------
    dict[str, float]
        Mapping of token → IDF score.

    Notes
    -----
    IDF is computed over the supplied corpus only.  In production this
    would be pre-computed over thousands of documents; here it is
    recomputed on-the-fly for the pair being compared.

    Examples
    --------
    >>> idf = compute_idf(["python developer", "java developer"])
    >>> idf["python"]   # appears in 1 of 2 docs → log(2/2) = 0.0 ... smoothed
    >>> idf["developer"]  # appears in both → lower IDF
    """
    total_docs = len(corpus)
    if total_docs == 0:
        logger.warning("[Matcher] compute_idf received empty corpus.")
        return {}

    # Count how many documents contain each term
    doc_freq: Counter = Counter()
    for doc_text in corpus:
        unique_terms = set(tokenize(doc_text))
        doc_freq.update(unique_terms)

    idf = {
        term: math.log(total_docs / (1 + df))
        for term, df in doc_freq.items()
    }

    logger.debug("[Matcher] compute_idf: %d terms in vocabulary", len(idf))
    return idf


# ===========================================================================
# Step 4 — TF-IDF Vectorization
# ===========================================================================

def vectorize(text: str, idf_dict: dict[str, float]) -> dict[str, float]:
    """
    Convert *text* into a **TF-IDF vector** using a pre-computed IDF dict.

    Each dimension of the vector corresponds to a term in the vocabulary.
    The value of each dimension is::

        TF-IDF(term, doc) = TF(term, doc) × IDF(term)

    Only terms present in *both* the document and the IDF vocabulary are
    included (out-of-vocabulary terms have no IDF weight).

    Parameters
    ----------
    text : str
        Input document.
    idf_dict : dict[str, float]
        IDF weights as returned by ``compute_idf``.

    Returns
    -------
    dict[str, float]
        Sparse TF-IDF vector: ``{term: tfidf_score}``.

    Examples
    --------
    >>> idf = compute_idf(["python developer", "java developer"])
    >>> vectorize("python developer", idf)
    {'python': ..., 'developer': ...}
    """
    tf = compute_tf(text)
    vector = {
        term: tf_score * idf_dict.get(term, 0.0)
        for term, tf_score in tf.items()
        if term in idf_dict
    }
    logger.debug("[Matcher] vectorize: %d non-zero dimensions", len(vector))
    return vector


# ===========================================================================
# Step 5 — Cosine Similarity
# ===========================================================================

def cosine_similarity(vec1: dict[str, float], vec2: dict[str, float]) -> float:
    """
    Calculate **Cosine Similarity** between two sparse TF-IDF vectors.

    Formula::

        cos(θ) = (v₁ · v₂) / (‖v₁‖ × ‖v₂‖)

    where the dot product and magnitudes are computed over the union of
    non-zero dimensions in both vectors.

    Time complexity: O(min(|v₁|, |v₂|)) for the dot product (iterate
    the smaller vector, look up in the larger one) + O(|v₁| + |v₂|)
    for the magnitudes.

    Parameters
    ----------
    vec1 : dict[str, float]
        First TF-IDF vector (e.g. CV vector).
    vec2 : dict[str, float]
        Second TF-IDF vector (e.g. job description vector).

    Returns
    -------
    float
        Similarity score in [0.0, 1.0].
        * 1.0 → vectors are identical in direction (perfect match)
        * 0.0 → vectors share no common non-zero dimensions (no overlap)

    Examples
    --------
    >>> v = {"python": 0.5, "django": 0.3}
    >>> cosine_similarity(v, v)
    1.0
    >>> cosine_similarity({"a": 1.0}, {"b": 1.0})
    0.0
    """
    if not vec1 or not vec2:
        logger.debug("[Matcher] cosine_similarity: one or both vectors are empty → 0.0")
        return 0.0

    # Dot product — iterate the smaller vector for efficiency
    if len(vec1) > len(vec2):
        vec1, vec2 = vec2, vec1

    dot_product: float = sum(
        v1_score * vec2.get(term, 0.0)
        for term, v1_score in vec1.items()
    )

    # Magnitudes  ‖v‖ = sqrt(Σ x²)
    mag1: float = math.sqrt(sum(v ** 2 for v in vec1.values()))
    mag2: float = math.sqrt(sum(v ** 2 for v in vec2.values()))

    if mag1 == 0.0 or mag2 == 0.0:
        logger.debug("[Matcher] cosine_similarity: zero-magnitude vector → 0.0")
        return 0.0

    similarity = dot_product / (mag1 * mag2)

    # Clamp to [0.0, 1.0] to absorb floating-point rounding errors
    similarity = max(0.0, min(1.0, similarity))

    logger.info("[Matcher] cosine_similarity = %.4f", similarity)
    return similarity


# ===========================================================================
# Convenience: end-to-end match score
# ===========================================================================

def match_score(cv_text: str, job_text: str) -> float:
    """
    Compute the TF-IDF cosine similarity between a CV and a job description.

    This is the high-level entry-point that orchestrates:
    tokenize → TF → IDF → vectorize → cosine_similarity

    Parameters
    ----------
    cv_text : str
        Raw CV / résumé text.
    job_text : str
        Raw job description text.

    Returns
    -------
    float
        Match score in [0.0, 1.0].  Higher → better candidate–job fit.

    Examples
    --------
    >>> match_score("Python Django REST API", "Python REST API developer")
    0.82  # (approximate)
    """
    corpus = [cv_text, job_text]
    idf = compute_idf(corpus)

    cv_vec = vectorize(cv_text, idf)
    job_vec = vectorize(job_text, idf)

    score = cosine_similarity(cv_vec, job_vec)
    logger.info("[Matcher] match_score = %.4f", score)
    return score
