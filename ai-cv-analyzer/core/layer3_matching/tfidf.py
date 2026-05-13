from __future__ import annotations

import math
import re
from collections import Counter

_STOP_WORDS: frozenset[str] = frozenset({
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
    "been", "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "can", "it", "its",
    "this", "that", "these", "those", "we", "you", "they", "my", "our",
    "your", "their", "not", "no", "all", "any", "more", "most", "other",
    "some", "such", "only", "same", "than", "too", "very", "about",
    "above", "after", "also", "between",
})


def tokenize(text: str) -> list[str]:
    return [
        token
        for token in re.split(r"\W+", text.lower())
        if len(token) >= 2 and token not in _STOP_WORDS
    ]


def _term_frequency(text: str) -> dict[str, float]:
    tokens = tokenize(text)
    if not tokens:
        return {}

    counts = Counter(tokens)
    total = len(tokens)
    return {term: count / total for term, count in counts.items()}


def _inverse_document_frequency(corpus: list[str]) -> dict[str, float]:
    if not corpus:
        return {}

    doc_freq: Counter[str] = Counter()
    for document in corpus:
        doc_freq.update(set(tokenize(document)))

    total_docs = len(corpus)
    return {
        term: math.log((1 + total_docs) / (1 + frequency)) + 1
        for term, frequency in doc_freq.items()
    }


def _vectorize(text: str, idf: dict[str, float]) -> dict[str, float]:
    tf = _term_frequency(text)
    return {
        term: score * idf[term]
        for term, score in tf.items()
        if term in idf
    }


def _cosine_similarity(first: dict[str, float], second: dict[str, float]) -> float:
    if not first or not second:
        return 0.0

    if len(first) > len(second):
        first, second = second, first

    dot_product = sum(value * second.get(term, 0.0) for term, value in first.items())
    first_magnitude = math.sqrt(sum(value ** 2 for value in first.values()))
    second_magnitude = math.sqrt(sum(value ** 2 for value in second.values()))

    if first_magnitude == 0.0 or second_magnitude == 0.0:
        return 0.0

    return max(0.0, min(1.0, dot_product / (first_magnitude * second_magnitude)))


def match_score(cv_text: str, job_text: str) -> float:
    corpus = [cv_text, job_text]
    idf = _inverse_document_frequency(corpus)

    return _cosine_similarity(
        _vectorize(cv_text, idf),
        _vectorize(job_text, idf),
    )
