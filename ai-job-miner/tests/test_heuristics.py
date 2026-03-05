"""
tests/test_heuristics.py
=========================
pytest test suite for the Phase 2 heuristic DOM-analysis algorithms.

Tests are fully offline — no HTTP calls, no mocking required.
All inputs are crafted HTML strings that are fed directly to BeautifulSoup.

Coverage
--------
✔ get_text_density — basic scoring, leaf node, zero-child node
✔ find_highest_density_node — correctly identifies the high-density div
  even when it has a meaningless CSS class, while ignoring header/footer
  noise divs that have lots of tags but little visible text
✔ extract_semantic_sibling — sibling pattern, definition-list pattern,
  table-cell pattern, inline pattern, keyword-absent case
✔ Edge cases — empty document, no matching keyword, very short nodes
"""

import pytest
from bs4 import BeautifulSoup, Tag

from core.heuristics import (
    extract_semantic_sibling,
    find_highest_density_node,
    get_text_density,
)

# ===========================================================================
# Shared helpers
# ===========================================================================

def _soup(html: str) -> BeautifulSoup:
    """Parse HTML and return a BeautifulSoup object using the pure-Python parser."""
    return BeautifulSoup(html, "html.parser")


# ===========================================================================
# 1. get_text_density Tests
# ===========================================================================

class TestGetTextDensity:
    """Unit tests for the text-density scoring algorithm."""

    def test_leaf_node_high_density(self):
        """
        A tag with lots of text and NO child tags should have density equal
        to the full text length (denominator = 0 + 1 = 1).
        """
        soup = _soup("<div>This is a long job description with many meaningful words.</div>")
        div = soup.find("div")
        density = get_text_density(div)
        # text length is ~59, no child tags → density ~ 59
        assert density > 50, f"Expected high density for leaf node, got {density}"

    def test_noisy_nav_node_low_density(self):
        """
        A navigation node with many child <a> tags but little text should
        score much lower than a prose content node.
        """
        soup = _soup(
            "<nav>"
            + "".join(f'<a href="/p{i}">L</a>' for i in range(20))
            + "</nav>"
        )
        nav = soup.find("nav")
        prose_soup = _soup("<div>" + ("Word " * 80) + "</div>")
        prose_div = prose_soup.find("div")

        nav_density = get_text_density(nav)
        prose_density = get_text_density(prose_div)

        assert prose_density > nav_density, (
            f"Prose ({prose_density:.1f}) should beat nav ({nav_density:.1f})"
        )

    def test_node_with_no_children_and_no_text(self):
        """An empty node must return 0.0 density (text length = 0)."""
        soup = _soup("<div></div>")
        div = soup.find("div")
        assert get_text_density(div) == 0.0

    def test_density_formula_correctness(self):
        """
        Manually verify the formula: density = len(text) / (child_tags + 1).
        Node: <div><span>Hi</span> Hello World</div>
          text  = "Hi Hello World" → 14 chars
          child_tags = 1 (the <span>)
          expected density = 14 / (1 + 1) = 7.0
        """
        soup = _soup("<div><span>Hi</span> Hello World</div>")
        div = soup.find("div")
        density = get_text_density(div)
        expected = len("Hi Hello World") / (1 + 1)
        assert abs(density - expected) < 1.0, (
            f"Expected density ~{expected:.1f}, got {density:.1f}"
        )


# ===========================================================================
# 2. find_highest_density_node Tests
# ===========================================================================

class TestFindHighestDensityNode:
    """
    Tests for the DFS density traversal algorithm.

    The key invariant: the algorithm must identify the correct content div
    even when it has a completely random / meaningless CSS class name.
    """

    # ------------------------------------------------------------------
    # Core fixture HTML — job description buried inside noise
    # ------------------------------------------------------------------
    JOB_PAGE_HTML = """
    <html>
    <body>
      <!-- HEADER: many tags, almost no text → low density -->
      <div class="hdr-7a2b">
        <a href="/">Home</a>
        <a href="/jobs">Jobs</a>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
        <a href="/faq">FAQ</a>
        <a href="/login">Login</a>
        <a href="/signup">Sign up</a>
      </div>

      <!-- MAIN CONTENT: the real job description — high density, >200 chars -->
      <div class="x-99-yz">
        We are looking for a passionate and experienced Senior Software Engineer
        to join our growing team. You will design, build, and maintain efficient,
        reusable, and reliable Python and JavaScript code. You will collaborate
        with cross-functional teams to define, design, and ship new features.
        You must have strong problem-solving skills and a deep understanding of
        data structures, algorithms, and distributed systems architecture.
        Experience with cloud platforms (AWS, GCP) is a strong plus.
      </div>

      <!-- SIDEBAR: many tags, little text → low density -->
      <div class="sidebar-32zq">
        <ul>
          <li><a href="#">Tag1</a></li>
          <li><a href="#">Tag2</a></li>
          <li><a href="#">Tag3</a></li>
          <li><a href="#">Tag4</a></li>
          <li><a href="#">Tag5</a></li>
          <li><a href="#">Tag6</a></li>
        </ul>
      </div>

      <!-- FOOTER: lots of links, little text → low density -->
      <div class="ftr-99ab">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/careers">Careers</a>
        <a href="/press">Press</a>
        <a href="/blog">Blog</a>
      </div>
    </body>
    </html>
    """

    def test_finds_description_div_by_density(self):
        """
        The algorithm must return text from the 'x-99-yz' div — the one
        with the highest text density — even though its class name is
        completely meaningless.
        """
        soup = _soup(self.JOB_PAGE_HTML)
        result = find_highest_density_node(soup)

        assert result is not None, "Should find a high-density node"
        # The unique phrase from our description div
        assert "passionate" in result.lower(), (
            f"Expected description content in result, got: {result[:100]}"
        )

    def test_does_not_return_header_or_nav_content(self):
        """Header/nav/footer link text must NOT be the primary result."""
        soup = _soup(self.JOB_PAGE_HTML)
        result = find_highest_density_node(soup)

        assert result is not None
        # "Home", "FAQ", "Login" are nav items — they must not be the result
        assert "Home" not in result or "passionate" in result

    def test_returns_none_when_no_node_meets_threshold(self):
        """
        If the page has no node with enough text, return None rather than
        raising an exception.
        """
        sparse_html = "<html><body><div class='a'><a>x</a><a>y</a></div></body></html>"
        soup = _soup(sparse_html)
        result = find_highest_density_node(soup, min_length=200)
        assert result is None

    def test_works_with_section_tag(self):
        """The algorithm must also consider <section> tags, not just <div>."""
        long_text = "A detailed job description. " * 15  # 420 chars
        html = f"<html><body><section class='jd-blk'>{long_text}</section></body></html>"
        soup = _soup(html)
        result = find_highest_density_node(soup)
        assert result is not None
        assert "detailed job description" in result

    def test_works_with_article_tag(self):
        """The algorithm must also consider <article> tags."""
        long_text = "We are hiring a skilled engineer. " * 10  # 340 chars
        html = f"<html><body><article class='zz-99'>{long_text}</article></body></html>"
        soup = _soup(html)
        result = find_highest_density_node(soup)
        assert result is not None
        assert "skilled engineer" in result

    def test_returns_none_on_empty_document(self):
        """An empty document must return None cleanly."""
        soup = _soup("<html><body></body></html>")
        result = find_highest_density_node(soup)
        assert result is None


# ===========================================================================
# 3. extract_semantic_sibling Tests
# ===========================================================================

class TestExtractSemanticSibling:
    """
    Tests for the semantic-proximity sibling-walk algorithm.

    Tests cover the four most common HTML patterns used for label–value pairs.
    """

    # ------------------------------------------------------------------
    # Pattern 1: <span> label + <strong> sibling value
    # ------------------------------------------------------------------
    def test_span_strong_sibling_pattern(self):
        """
        Most common pattern found on job boards:
        <div><span>Salary:</span><strong>$10,000 - $15,000</strong></div>
        """
        html = "<div><span>Salary:</span> <strong>$10,000 - $15,000</strong></div>"
        soup = _soup(html)
        result = extract_semantic_sibling(soup, "Salary")
        assert result is not None, "Should find salary in sibling <strong>"
        assert "$10,000" in result or "15,000" in result, (
            f"Expected salary range in result, got: {result}"
        )

    # ------------------------------------------------------------------
    # Pattern 2: <dt> / <dd> definition list
    # ------------------------------------------------------------------
    def test_definition_list_pattern(self):
        """
        Definition-list pattern: <dt>Salary</dt><dd>£50,000 per annum</dd>
        """
        html = "<dl><dt>Salary</dt><dd>£50,000 per annum</dd></dl>"
        soup = _soup(html)
        result = extract_semantic_sibling(soup, "Salary")
        assert result is not None, "Should find salary in <dd> sibling"
        assert "50,000" in result, f"Expected '50,000' in result, got: {result}"

    # ------------------------------------------------------------------
    # Pattern 3: case-insensitive keyword matching
    # ------------------------------------------------------------------
    def test_case_insensitive_keyword(self):
        """Keyword matching must be case-insensitive: 'SALARY', 'salary', 'Salary'."""
        html = "<div><span>SALARY:</span><em>$95,000/yr</em></div>"
        soup = _soup(html)
        result_lower = extract_semantic_sibling(soup, "salary")
        result_upper = extract_semantic_sibling(soup, "SALARY")
        result_title = extract_semantic_sibling(soup, "Salary")
        assert result_lower is not None
        assert result_upper is not None
        assert result_title is not None
        assert "95,000" in (result_lower or "")

    # ------------------------------------------------------------------
    # Pattern 4: inline value in the same node
    # ------------------------------------------------------------------
    def test_inline_label_value_pattern(self):
        """
        Some sites put label and value in the same node:
        <li>Salary: $80k - $100k per year</li>
        The algorithm must extract the part after the keyword.
        """
        html = "<ul><li>Salary: $80k - $100k per year</li></ul>"
        soup = _soup(html)
        result = extract_semantic_sibling(soup, "Salary")
        assert result is not None, "Should handle inline label:value pattern"
        assert "$80k" in result or "80k" in result, (
            f"Expected salary value in result, got: {result}"
        )

    # ------------------------------------------------------------------
    # Pattern 5: table cell (td) sibling
    # ------------------------------------------------------------------
    def test_table_cell_pattern(self):
        """
        Table pattern: <tr><td>Pay</td><td>$120,000</td></tr>
        The algorithm must walk to the next <td> sibling.
        """
        html = "<table><tr><td>Pay</td><td>$120,000</td></tr></table>"
        soup = _soup(html)
        result = extract_semantic_sibling(soup, "Pay")
        assert result is not None, "Should find value in adjacent <td>"
        assert "120,000" in result, f"Expected '120,000', got: {result}"

    # ------------------------------------------------------------------
    # Pattern 6: Alternate keywords (compensation, wage)
    # ------------------------------------------------------------------
    def test_alternate_keyword_compensation(self):
        """The algorithm must work with synonyms, not just 'Salary'."""
        html = "<p><b>Compensation:</b> $65,000 – $75,000 annually</p>"
        soup = _soup(html)
        result = extract_semantic_sibling(soup, "Compensation")
        # Either via sibling or inline fallback
        assert result is not None
        assert "65,000" in result or "75,000" in result or "annually" in result

    # ------------------------------------------------------------------
    # Edge case: keyword not present
    # ------------------------------------------------------------------
    def test_returns_none_when_keyword_absent(self):
        """Must return None cleanly when the keyword does not appear in the doc."""
        html = "<div><span>Location:</span><span>New York</span></div>"
        soup = _soup(html)
        result = extract_semantic_sibling(soup, "Salary")
        assert result is None, (
            f"Expected None when keyword is absent, got: {result}"
        )

    # ------------------------------------------------------------------
    # Edge case: empty document
    # ------------------------------------------------------------------
    def test_returns_none_on_empty_document(self):
        """Must return None cleanly for an empty / minimal document."""
        soup = _soup("<html><body></body></html>")
        result = extract_semantic_sibling(soup, "Salary")
        assert result is None


# ===========================================================================
# 4. Integration: Both algorithms on the same document
# ===========================================================================

class TestIntegration:
    """
    End-to-end test: run both heuristic algorithms on a single realistic
    job-listing HTML page.
    """

    REALISTIC_JOB_HTML = """
    <html>
    <head><title>Senior Python Engineer — AcmeCorp</title></head>
    <body>
      <nav>
        <a href="/">Home</a><a href="/jobs">Jobs</a><a href="/about">About</a>
      </nav>

      <header class="header-xk99">
        <h1>Senior Python Engineer</h1>
        <span class="company-zz1">AcmeCorp</span>
      </header>

      <section class="meta-ab12">
        <span>Location:</span><span>Remote (US)</span>
        <span>Salary:</span><strong>$130,000 - $160,000 per year</strong>
        <span>Type:</span><span>Full-time</span>
      </section>

      <!-- This is the description — verbose prose, high density -->
      <div class="content-unk-92b4">
        AcmeCorp is a fast-growing fintech company building the infrastructure
        for the next generation of financial services. We are looking for a
        Senior Python Engineer to lead the development of our core data
        pipeline. You will work closely with our ML team to deploy models
        at scale. Requirements: 5+ years of Python, experience with asyncio,
        PostgreSQL, and AWS. You will be responsible for designing RESTful APIs
        and microservices, mentoring junior engineers, conducting code reviews,
        and participating in on-call rotations. Competitive benefits package
        including health, dental, and vision insurance.
      </div>

      <footer class="footer-zz11">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </footer>
    </body>
    </html>
    """

    def test_description_extraction(self):
        """DFS density algorithm must identify the prose content div."""
        soup = _soup(self.REALISTIC_JOB_HTML)
        description = find_highest_density_node(soup)

        assert description is not None
        assert "fintech" in description.lower() or "python" in description.lower(), (
            f"Unexpected description content: {description[:120]}"
        )

    def test_salary_extraction(self):
        """Semantic proximity algorithm must extract the salary figure."""
        soup = _soup(self.REALISTIC_JOB_HTML)
        salary = extract_semantic_sibling(soup, "Salary")

        assert salary is not None, "Salary must be found in realistic HTML"
        assert "130,000" in salary or "160,000" in salary or "130" in salary, (
            f"Expected salary range in result, got: {salary}"
        )

    def test_description_does_not_contain_nav_links(self):
        """The description must not be the nav block (low-density)."""
        soup = _soup(self.REALISTIC_JOB_HTML)
        description = find_highest_density_node(soup)
        assert description is not None
        # If it accidentally grabbed the nav, it would only contain link texts
        nav_only = all(w in ("home", "jobs", "about") for w in description.lower().split()[:5])
        assert not nav_only, "Description must not be the nav block"
