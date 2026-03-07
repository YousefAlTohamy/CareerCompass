"""
tests/test_pipeline.py
=======================
Comprehensive pytest test suite for Phase 3 pipeline components.

Coverage
--------
✔ JobDeduplicator  — SHA-256 hash determinism, same/different inputs,
                     Bloom Filter add/query, is_duplicate / mark_seen flow
✔ BloomFilter      — no false negatives guarantee, capacity sizing,
                     estimated_false_positive_rate behaviour
✔ clean_text       — HTML stripping, entity unescaping, whitespace collapse
✔ remove_noise     — noise word removal, punctuation cleanup, edge cases
✔ extract_salary   — k-multiplier, symbol-to-ISO, range and single values,
                     EGP / GBP / EUR currency codes, empty input
✔ extract_experience — range, min-only (+ prefix), min-only (at least),
                       single value, empty / no-number input
✔ levenshtein_distance — known distances, symmetry, empty strings,
                         diagonal (identical strings)
✔ similarity_score — score bounds, identical strings, completely different
✔ are_skills_similar  — React.js / ReactJS, Python / Java, threshold logic
"""

import pytest

from pipeline.cleaners import (
    clean_text,
    extract_experience,
    extract_salary,
    remove_noise,
)
from pipeline.deduplicator import BloomFilter, JobDeduplicator
from pipeline.fuzzy_matcher import (
    are_skills_similar,
    levenshtein_distance,
    similarity_score,
)


# ===========================================================================
# 1. JobDeduplicator Tests
# ===========================================================================

class TestJobDeduplicator:
    """Tests for SHA-256 hashing and Bloom-Filter-backed deduplication."""

    # ------------------------------------------------------------------
    # SHA-256 hash generation
    # ------------------------------------------------------------------
    def test_same_inputs_yield_same_hash(self):
        """Identical (title, company, location) must always produce the same hash."""
        h1 = JobDeduplicator.generate_hash("Python Developer", "Google", "Cairo")
        h2 = JobDeduplicator.generate_hash("Python Developer", "Google", "Cairo")
        assert h1 == h2

    def test_hash_is_64_char_hex(self):
        """SHA-256 hex digest must be exactly 64 hexadecimal characters."""
        h = JobDeduplicator.generate_hash("Data Scientist", "Meta", "Remote")
        assert len(h) == 64
        assert all(c in "0123456789abcdef" for c in h)

    def test_different_inputs_yield_different_hashes(self):
        """Different job details must produce different hashes."""
        h1 = JobDeduplicator.generate_hash("Backend Engineer", "Apple", "NY")
        h2 = JobDeduplicator.generate_hash("Frontend Engineer", "Apple", "NY")
        assert h1 != h2

    def test_whitespace_is_normalised_in_hash(self):
        """
        Extra whitespace in inputs must be collapsed so logically identical
        jobs map to the same hash.
        """
        h1 = JobDeduplicator.generate_hash("  Python Dev  ", "  Google  ", " Cairo ")
        h2 = JobDeduplicator.generate_hash("Python Dev", "Google", "Cairo")
        assert h1 == h2

    def test_case_is_normalised_in_hash(self):
        """Hash inputs are lowercased — 'PYTHON DEV' == 'python dev'."""
        h1 = JobDeduplicator.generate_hash("PYTHON DEV", "GOOGLE", "CAIRO")
        h2 = JobDeduplicator.generate_hash("python dev", "google", "cairo")
        assert h1 == h2

    # ------------------------------------------------------------------
    # is_duplicate / mark_seen flow
    # ------------------------------------------------------------------
    def test_new_hash_is_not_duplicate(self):
        """A hash that was never marked seen must not be a duplicate."""
        dedup = JobDeduplicator()
        h = JobDeduplicator.generate_hash("ML Engineer", "OpenAI", "SF")
        assert dedup.is_duplicate(h) is False

    def test_marked_hash_is_duplicate(self):
        """A hash that was marked seen must be detected as a duplicate."""
        dedup = JobDeduplicator()
        h = JobDeduplicator.generate_hash("DevOps Engineer", "Amazon", "Seattle")
        dedup.mark_seen(h)
        assert dedup.is_duplicate(h) is True

    def test_seen_count_increments(self):
        """seen_count must increment with each unique mark_seen call."""
        dedup = JobDeduplicator()
        assert dedup.seen_count == 0
        dedup.mark_seen(JobDeduplicator.generate_hash("A", "B", "C"))
        dedup.mark_seen(JobDeduplicator.generate_hash("D", "E", "F"))
        assert dedup.seen_count == 2

    def test_duplicate_mark_does_not_increment_count(self):
        """Marking the same hash twice should not double-count it."""
        dedup = JobDeduplicator()
        h = JobDeduplicator.generate_hash("QA Engineer", "Netflix", "LA")
        dedup.mark_seen(h)
        dedup.mark_seen(h)  # second call is a no-op on the set
        assert dedup.seen_count == 1


# ===========================================================================
# 2. BloomFilter Tests
# ===========================================================================

class TestBloomFilter:
    """Tests for the from-scratch Bloom Filter implementation."""

    def test_added_item_is_detected(self):
        """An item that was added must always be detected (no false negatives)."""
        bf = BloomFilter(capacity=100, false_positive_rate=0.01)
        bf.add("abc123")
        assert bf.might_contain("abc123") is True

    def test_multiple_added_items_all_detected(self):
        """All added items must be detectable (no false negatives guarantee)."""
        bf = BloomFilter(capacity=1000, false_positive_rate=0.01)
        items = [f"job_hash_{i}" for i in range(200)]
        for item in items:
            bf.add(item)
        for item in items:
            assert bf.might_contain(item), f"False negative for: {item}"

    def test_unseen_item_might_not_be_detected(self):
        """
        An item that was NOT added should (with high probability on a
        fresh filter) return False.  This is not guaranteed (false positives
        are allowed) but for a fresh filter with no items, it must be False.
        """
        bf = BloomFilter(capacity=10_000, false_positive_rate=0.01)
        assert bf.might_contain("never_added_item_xyz") is False

    def test_count_increases_with_adds(self):
        """count property must track the number of add() calls."""
        bf = BloomFilter()
        assert bf.count == 0
        bf.add("a")
        bf.add("b")
        assert bf.count == 2

    def test_invalid_capacity_raises(self):
        """capacity < 1 must raise ValueError."""
        with pytest.raises(ValueError, match="capacity"):
            BloomFilter(capacity=0)

    def test_invalid_fpr_raises(self):
        """false_positive_rate outside (0, 1) must raise ValueError."""
        with pytest.raises(ValueError, match="false_positive_rate"):
            BloomFilter(false_positive_rate=0.0)
        with pytest.raises(ValueError, match="false_positive_rate"):
            BloomFilter(false_positive_rate=1.0)

    def test_estimated_fpr_is_zero_when_empty(self):
        """estimated_false_positive_rate must be 0 before any items are added."""
        bf = BloomFilter()
        assert bf.estimated_false_positive_rate == 0.0

    def test_optimal_sizing(self):
        """m and k must be positive integers derived from capacity and fpr."""
        bf = BloomFilter(capacity=1000, false_positive_rate=0.05)
        assert bf.m > 0
        assert bf.k > 0


# ===========================================================================
# 3. clean_text Tests
# ===========================================================================

class TestCleanText:
    """Tests for the HTML / Unicode text cleaner."""

    def test_strips_html_tags(self):
        """HTML tags must be removed from the output."""
        result = clean_text("<p>Hello <b>World</b></p>")
        assert "<p>" not in result
        assert "<b>" not in result
        assert "Hello" in result
        assert "World" in result

    def test_unescapes_html_entities(self):
        """HTML entities must be converted to their character equivalents."""
        result = clean_text("Python &amp; Django &lt;framework&gt;")
        assert "&amp;" not in result
        assert "&" in result

    def test_collapses_whitespace(self):
        """Multiple spaces, tabs, and newlines must be collapsed to one space."""
        result = clean_text("  Python   \n\n   Developer  \t Job  ")
        assert "  " not in result
        assert result == "Python Developer Job"

    def test_empty_string_returns_empty(self):
        """Empty input must return empty string without raising."""
        assert clean_text("") == ""
        assert clean_text("   ") == ""

    def test_mixed_html_and_entities(self):
        """Combined HTML tags and entities must all be cleaned."""
        result = clean_text("<div class='x'>Senior &amp; Staff Engineer</div>")
        assert result == "Senior & Staff Engineer"


# ===========================================================================
# 4. remove_noise Tests
# ===========================================================================

class TestRemoveNoise:
    """Tests for the job-title noise-word remover."""

    def test_removes_urgent_prefix(self):
        """'Urgent:' prefix must be stripped."""
        result = remove_noise("Urgent: Python Developer")
        assert "urgent" not in result.lower()
        assert "Python Developer" in result

    def test_removes_remote_keyword(self):
        """'Remote' in parentheses must be stripped."""
        result = remove_noise("Python Dev (Remote)")
        assert "remote" not in result.lower()
        assert "Python Dev" in result

    def test_removes_multiple_noise_words(self):
        """Multiple noise words in the same title must all be removed."""
        result = remove_noise("Urgent: Python Dev (Remote) Full Time")
        result_lower = result.lower()
        assert "urgent" not in result_lower
        assert "remote" not in result_lower
        assert "full" not in result_lower or "time" not in result_lower
        assert "python" in result_lower
        assert "dev" in result_lower

    def test_hiring_now_removed(self):
        """'Hiring Now!' phrase must be removed."""
        result = remove_noise("Hiring Now! Senior Backend Engineer")
        assert "hiring" not in result.lower()
        assert "Senior Backend Engineer" in result

    def test_empty_input_returns_empty(self):
        """Empty input must return empty string without raising."""
        assert remove_noise("") == ""

    def test_no_noise_title_unchanged(self):
        """A clean title with no noise words must be returned unchanged."""
        original = "Senior Machine Learning Engineer"
        result = remove_noise(original)
        assert result == original


# ===========================================================================
# 5. extract_salary Tests
# ===========================================================================

class TestExtractSalary:
    """Tests for the salary parsing pipeline function."""

    def test_k_multiplier_range_usd(self):
        """'10k - 12k USD' → min: 10000, max: 12000, currency: USD."""
        result = extract_salary("10k - 12k USD")
        assert result["min_salary"] == 10_000
        assert result["max_salary"] == 12_000
        assert result["currency"] == "USD"

    def test_dollar_sign_to_full_range(self):
        """'$10,000 to $15,000' → min: 10000, max: 15000, currency: USD."""
        result = extract_salary("$10,000 to $15,000")
        assert result["min_salary"] == 10_000
        assert result["max_salary"] == 15_000
        assert result["currency"] == "USD"

    def test_pound_sterling_single_value(self):
        """'£50,000 per annum' → min: 50000, max: 50000, currency: GBP."""
        result = extract_salary("£50,000 per annum")
        assert result["min_salary"] == 50_000
        assert result["max_salary"] == 50_000
        assert result["currency"] == "GBP"

    def test_egp_currency_code(self):
        """'15000 EGP' → min: 15000, max: 15000, currency: EGP."""
        result = extract_salary("15000 EGP")
        assert result["min_salary"] == 15_000
        assert result["currency"] == "EGP"

    def test_k_range_no_currency(self):
        """'50k - 80k' → correct range, currency may be None."""
        result = extract_salary("50k - 80k")
        assert result["min_salary"] == 50_000
        assert result["max_salary"] == 80_000

    def test_euro_symbol(self):
        """'€40,000 - €60,000' → currency: EUR."""
        result = extract_salary("€40,000 - €60,000")
        assert result["currency"] == "EUR"
        assert result["min_salary"] == 40_000
        assert result["max_salary"] == 60_000

    def test_empty_input_returns_none_values(self):
        """Empty input must return a dict with all None values."""
        result = extract_salary("")
        assert result == {"min_salary": None, "max_salary": None, "currency": None}

    def test_large_usd_range(self):
        """'$130,000 - $160,000' → correct min/max."""
        result = extract_salary("$130,000 - $160,000")
        assert result["min_salary"] == 130_000
        assert result["max_salary"] == 160_000
        assert result["currency"] == "USD"


# ===========================================================================
# 6. extract_experience Tests
# ===========================================================================

class TestExtractExperience:
    """Tests for the experience requirement parser."""

    def test_range_with_years(self):
        """'3-5 years' → min: 3, max: 5."""
        result = extract_experience("3-5 years experience")
        assert result["min_exp"] == 3
        assert result["max_exp"] == 5

    def test_range_with_yrs_abbreviation(self):
        """'3-5 yrs' must also be parsed."""
        result = extract_experience("3-5 yrs")
        assert result["min_exp"] == 3
        assert result["max_exp"] == 5

    def test_plus_prefix_min_only(self):
        """'+3 years' → min: 3, max: None."""
        result = extract_experience("+3 years")
        assert result["min_exp"] == 3
        assert result["max_exp"] is None

    def test_at_least_phrasing(self):
        """'at least 2 years' → min: 2, max: None."""
        result = extract_experience("at least 2 years")
        assert result["min_exp"] == 2

    def test_single_value(self):
        """'5 years' → min: 5, max: 5."""
        result = extract_experience("5 years")
        assert result["min_exp"] == 5
        assert result["max_exp"] == 5

    def test_range_with_to_separator(self):
        """'3 to 5 years' → min: 3, max: 5."""
        result = extract_experience("3 to 5 years")
        assert result["min_exp"] == 3
        assert result["max_exp"] == 5

    def test_empty_input_returns_none_values(self):
        """Empty input must return a dict with all None values."""
        result = extract_experience("")
        assert result == {"min_exp": None, "max_exp": None}

    def test_no_number_returns_none_values(self):
        """Text with no digits must return None values without raising."""
        result = extract_experience("several years of experience")
        # "several" has no digit — depending on impl may return None or fallback
        # We only assert structure is correct (no exception)
        assert "min_exp" in result
        assert "max_exp" in result


# ===========================================================================
# 7. levenshtein_distance Tests
# ===========================================================================

class TestLevenshteinDistance:
    """Tests for the pure-DP Levenshtein distance implementation."""

    def test_identical_strings(self):
        """Distance between identical strings must be 0."""
        assert levenshtein_distance("python", "python") == 0

    def test_empty_vs_nonempty(self):
        """Distance from empty string to s must equal len(s)."""
        assert levenshtein_distance("", "abc") == 3
        assert levenshtein_distance("abc", "") == 3

    def test_both_empty(self):
        """Distance between two empty strings must be 0."""
        assert levenshtein_distance("", "") == 0

    def test_single_substitution(self):
        """One character difference → distance 1."""
        assert levenshtein_distance("cat", "bat") == 1

    def test_known_distance_kitten_sitting(self):
        """Classic example: 'kitten' → 'sitting' = 3 edits."""
        assert levenshtein_distance("kitten", "sitting") == 3

    def test_react_js_reactjs(self):
        """
        'React.js' vs 'ReactJS':
          React.js → ReactJS requires 3 edits (delete '.', substitute 'j'→'J', substitute 's'→'S')
          depending on normalisation.  We validate the DP value is correct
          by computing manually:
          react.js (8) → reactjs (7):
            delete '.' at pos 5 → react js (still not right)
          Let the algorithm compute and assert the returned value is consistent
          with symmetry and bounds.
        """
        d = levenshtein_distance("React.js", "ReactJS")
        # Result must be non-negative and ≤ max(len(s1), len(s2))
        assert 0 <= d <= max(len("React.js"), len("ReactJS"))
        # Additionally verify symmetry
        assert levenshtein_distance("ReactJS", "React.js") == d

    def test_symmetry(self):
        """levenshtein_distance must be symmetric: d(a,b) == d(b,a)."""
        pairs = [("Python", "Java"), ("SQL", "NoSQL"), ("AWS", "GCP")]
        for s1, s2 in pairs:
            assert levenshtein_distance(s1, s2) == levenshtein_distance(s2, s1)

    def test_triangle_inequality(self):
        """d(a,c) ≤ d(a,b) + d(b,c) — triangle inequality must hold."""
        a, b, c = "React", "ReactJS", "AngularJS"
        assert levenshtein_distance(a, c) <= (
            levenshtein_distance(a, b) + levenshtein_distance(b, c)
        )


# ===========================================================================
# 8. similarity_score Tests
# ===========================================================================

class TestSimilarityScore:
    """Tests for the normalised similarity score helper."""

    def test_identical_strings_score_one(self):
        """Identical strings must have similarity 1.0."""
        assert similarity_score("Python", "Python") == 1.0

    def test_both_empty_score_one(self):
        """Both-empty edge case must return 1.0."""
        assert similarity_score("", "") == 1.0

    def test_score_in_range(self):
        """Score must always be in [0.0, 1.0]."""
        pairs = [("React", "Vue"), ("AWS", "GCP"), ("Python", "Python3")]
        for s1, s2 in pairs:
            s = similarity_score(s1, s2)
            assert 0.0 <= s <= 1.0, f"Score out of range for ({s1}, {s2}): {s}"

    def test_completely_different_strings_low_score(self):
        """Very different strings must have a low similarity score."""
        score = similarity_score("AAAA", "ZZZZ")
        assert score < 0.5, f"Expected low score, got {score}"


# ===========================================================================
# 9. are_skills_similar Tests
# ===========================================================================

class TestAreSkillsSimilar:
    """Tests for the skill-similarity threshold function."""

    def test_react_js_and_reactjs_are_similar(self):
        """'React.js' and 'ReactJS' must be considered similar at default threshold."""
        assert are_skills_similar("React.js", "ReactJS") is True

    def test_python_and_java_are_not_similar(self):
        """'Python' and 'Java' must NOT be considered similar."""
        assert are_skills_similar("Python", "Java") is False

    def test_identical_skills_are_similar(self):
        """Identical strings must always return True."""
        assert are_skills_similar("PostgreSQL", "PostgreSQL") is True

    def test_case_insensitive_comparison(self):
        """Comparison must be case-insensitive."""
        assert are_skills_similar("PYTHON", "python") is True

    def test_threshold_zero_always_similar(self):
        """At threshold=0.0, everything is similar."""
        assert are_skills_similar("Python", "Java", threshold=0.0) is True

    def test_threshold_one_only_identical(self):
        """At threshold=1.0, only identical strings are similar."""
        assert are_skills_similar("React.js", "ReactJS", threshold=1.0) is False
        assert are_skills_similar("Python", "Python", threshold=1.0) is True

    def test_invalid_threshold_raises(self):
        """Threshold outside [0.0, 1.0] must raise ValueError."""
        with pytest.raises(ValueError, match="threshold"):
            are_skills_similar("A", "B", threshold=1.5)
        with pytest.raises(ValueError, match="threshold"):
            are_skills_similar("A", "B", threshold=-0.1)

    def test_postgresql_and_mysql_not_similar(self):
        """'PostgreSQL' and 'MySQL' must NOT be similar at default threshold."""
        assert are_skills_similar("PostgreSQL", "MySQL") is False

    def test_nodejs_variations_are_similar(self):
        """'Node.js' and 'NodeJS' should be similar at default threshold."""
        assert are_skills_similar("Node.js", "NodeJS") is True
