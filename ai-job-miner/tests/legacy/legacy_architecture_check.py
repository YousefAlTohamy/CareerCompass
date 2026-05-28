"""
tests/test_architecture.py
===========================
Comprehensive pytest + pytest-asyncio test suite for Phase 1 of the
Smart AI Scraper Engine.

Test coverage:
  ✔ ScraperFactory returns correct instance types
  ✔ ScraperFactory raises ValueError for unknown types
  ✔ BaseScraper cannot be instantiated directly (ABC enforcement)
  ✔ fetch_content handles successful HTTP responses
  ✔ fetch_content handles ClientResponseError (4xx/5xx)
  ✔ fetch_content handles ServerTimeoutError
  ✔ fetch_content handles generic/unexpected exceptions
  ✔ ScraperFactory.registered_types() returns expected keys
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import aiohttp
import pytest
import pytest_asyncio  # noqa: F401 — imported to ensure plugin is loaded

from core.base_scraper import BaseScraper
from factories.scraper_factory import ScraperFactory
from strategies.api_scraper import JsonApiScraper
from strategies.html_scraper import HtmlSmartScraper

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_mock_response(
    status: int = 200,
    text_body: str = "<html>Hello</html>",
    raise_for_status_exc: Exception | None = None,
) -> MagicMock:
    """
    Build a MagicMock that mimics an aiohttp.ClientResponse for use inside
    ``async with session.get(...) as response:`` blocks.
    """
    mock_response = MagicMock()
    mock_response.status = status

    # raise_for_status is a regular (sync) method on ClientResponse
    if raise_for_status_exc:
        mock_response.raise_for_status = MagicMock(side_effect=raise_for_status_exc)
    else:
        mock_response.raise_for_status = MagicMock()

    # response.text() is a coroutine
    mock_response.text = AsyncMock(return_value=text_body)

    # Support ``async with`` on the response object itself
    mock_response.__aenter__ = AsyncMock(return_value=mock_response)
    mock_response.__aexit__ = AsyncMock(return_value=False)

    return mock_response


def _make_mock_session(mock_response: MagicMock) -> MagicMock:
    """
    Build a MagicMock that mimics an aiohttp.ClientSession supporting
    ``async with session.get(...) as response:`` usage.
    """
    mock_session = MagicMock()
    mock_session.get = MagicMock(return_value=mock_response)
    return mock_session


# ===========================================================================
# 1. ScraperFactory Tests
# ===========================================================================

class TestScraperFactory:
    """Tests for the Factory Pattern implementation."""

    def test_get_scraper_html_returns_html_scraper(self):
        """Factory must return an HtmlSmartScraper instance for type 'html'."""
        scraper = ScraperFactory.get_scraper("html")
        assert isinstance(scraper, HtmlSmartScraper), (
            f"Expected HtmlSmartScraper, got {type(scraper).__name__}"
        )

    def test_get_scraper_api_returns_json_api_scraper(self):
        """Factory must return a JsonApiScraper instance for type 'api'."""
        scraper = ScraperFactory.get_scraper("api")
        assert isinstance(scraper, JsonApiScraper), (
            f"Expected JsonApiScraper, got {type(scraper).__name__}"
        )

    def test_get_scraper_is_base_scraper_subclass(self):
        """All returned scrapers must satisfy the BaseScraper interface."""
        for source_type in ("html", "api"):
            scraper = ScraperFactory.get_scraper(source_type)
            assert isinstance(scraper, BaseScraper), (
                f"Scraper for '{source_type}' does not inherit from BaseScraper"
            )

    def test_get_scraper_case_insensitive(self):
        """Factory must normalise the type string (case-insensitive)."""
        assert isinstance(ScraperFactory.get_scraper("HTML"), HtmlSmartScraper)
        assert isinstance(ScraperFactory.get_scraper("Api"), JsonApiScraper)
        assert isinstance(ScraperFactory.get_scraper("  html  "), HtmlSmartScraper)

    def test_get_scraper_raises_value_error_for_unknown_type(self):
        """Factory must raise ValueError for unrecognised source types."""
        with pytest.raises(ValueError, match="Unknown source type"):
            ScraperFactory.get_scraper("xml")

    def test_get_scraper_raises_value_error_for_empty_string(self):
        """Factory must raise ValueError when given an empty (whitespace) string."""
        with pytest.raises(ValueError):
            ScraperFactory.get_scraper("")

    def test_get_scraper_raises_value_error_for_graphql(self):
        """Factory must raise ValueError for a plausible-but-unregistered type."""
        with pytest.raises(ValueError, match="graphql"):
            ScraperFactory.get_scraper("graphql")

    def test_registered_types_returns_sorted_list(self):
        """registered_types() must return a sorted list of all supported keys."""
        types = ScraperFactory.registered_types()
        assert isinstance(types, list)
        assert sorted(types) == types
        assert "html" in types
        assert "api" in types

    def test_factory_returns_new_instance_each_call(self):
        """Factory must return a fresh instance on every call (not a singleton)."""
        scraper_a = ScraperFactory.get_scraper("html")
        scraper_b = ScraperFactory.get_scraper("html")
        assert scraper_a is not scraper_b


# ===========================================================================
# 2. Abstract Base Class Enforcement Tests
# ===========================================================================

class TestBaseScraperAbstraction:
    """Ensure BaseScraper cannot be instantiated directly."""

    def test_base_scraper_cannot_be_instantiated(self):
        """
        Python's ABC machinery must prevent direct instantiation of BaseScraper
        because `scrape` is marked @abstractmethod.
        """
        with pytest.raises(TypeError, match="abstract"):
            BaseScraper()  # type: ignore[abstract]

    def test_incomplete_subclass_cannot_be_instantiated(self):
        """
        A subclass that forgets to implement `scrape` must also be uninstantiable.
        """
        class IncompleteScraper(BaseScraper):
            pass  # Deliberately omits the `scrape` implementation

        with pytest.raises(TypeError, match="abstract"):
            IncompleteScraper()  # type: ignore[abstract]

    def test_complete_subclass_can_be_instantiated(self):
        """
        A subclass that properly implements `scrape` must be instantiable.
        """
        class CompleteScraper(BaseScraper):
            async def scrape(self, url: str, **kwargs) -> dict:
                return {"type": "test", "content": None, "status": "success"}

        scraper = CompleteScraper()
        assert isinstance(scraper, BaseScraper)


# ===========================================================================
# 3. fetch_content Tests (using mocked aiohttp)
# ===========================================================================

class TestFetchContent:
    """
    Tests for BaseScraper.fetch_content using a MinimalScraper concrete stub.
    All aiohttp network I/O is mocked — no real HTTP calls are made.
    """

    # Minimal concrete subclass used purely for testing fetch_content
    class _StubScraper(BaseScraper):
        async def scrape(self, url: str, **kwargs) -> dict:
            return {}

    # ------------------------------------------------------------------
    # Success path
    # ------------------------------------------------------------------
    @pytest.mark.asyncio
    async def test_fetch_content_returns_text_on_success(self):
        """fetch_content must return the response body as a string on HTTP 200."""
        expected_html = "<html><body>Hello World</body></html>"
        mock_response = _make_mock_response(status=200, text_body=expected_html)
        mock_session = _make_mock_session(mock_response)

        scraper = self._StubScraper()
        result = await scraper.fetch_content("https://example.com", mock_session)

        assert result == expected_html
        mock_session.get.assert_called_once()
        mock_response.raise_for_status.assert_called_once()

    # ------------------------------------------------------------------
    # HTTP error (4xx / 5xx)
    # ------------------------------------------------------------------
    @pytest.mark.asyncio
    async def test_fetch_content_raises_on_http_error(self):
        """fetch_content must re-raise ClientResponseError for 4xx/5xx responses."""
        http_error = aiohttp.ClientResponseError(
            request_info=MagicMock(),
            history=(),
            status=404,
            message="Not Found",
        )
        mock_response = _make_mock_response(raise_for_status_exc=http_error)
        mock_session = _make_mock_session(mock_response)

        scraper = self._StubScraper()
        with pytest.raises(aiohttp.ClientResponseError) as exc_info:
            await scraper.fetch_content("https://example.com/missing", mock_session)

        assert exc_info.value.status == 404

    # ------------------------------------------------------------------
    # Timeout
    # ------------------------------------------------------------------
    @pytest.mark.asyncio
    async def test_fetch_content_raises_on_timeout(self):
        """fetch_content must re-raise ServerTimeoutError on network timeout."""
        mock_session = MagicMock()
        timeout_exc = aiohttp.ServerTimeoutError()

        # session.get() itself raises the timeout before entering the context
        mock_session.get = MagicMock(
            return_value=MagicMock(
                __aenter__=AsyncMock(side_effect=timeout_exc),
                __aexit__=AsyncMock(return_value=False),
            )
        )

        scraper = self._StubScraper()
        with pytest.raises(aiohttp.ServerTimeoutError):
            await scraper.fetch_content("https://slow.example.com", mock_session)

    # ------------------------------------------------------------------
    # Connection error
    # ------------------------------------------------------------------
    @pytest.mark.asyncio
    async def test_fetch_content_raises_on_connection_error(self):
        """fetch_content must re-raise ClientConnectionError on network failures."""
        mock_session = MagicMock()
        conn_error = aiohttp.ClientConnectionError("Cannot connect")

        mock_session.get = MagicMock(
            return_value=MagicMock(
                __aenter__=AsyncMock(side_effect=conn_error),
                __aexit__=AsyncMock(return_value=False),
            )
        )

        scraper = self._StubScraper()
        with pytest.raises(aiohttp.ClientConnectionError):
            await scraper.fetch_content("https://unreachable.example.com", mock_session)

    # ------------------------------------------------------------------
    # Unexpected / generic exception
    # ------------------------------------------------------------------
    @pytest.mark.asyncio
    async def test_fetch_content_raises_on_unexpected_exception(self):
        """fetch_content must re-raise any unexpected exceptions after logging."""
        mock_session = MagicMock()
        mock_session.get = MagicMock(
            return_value=MagicMock(
                __aenter__=AsyncMock(side_effect=RuntimeError("Boom!")),
                __aexit__=AsyncMock(return_value=False),
            )
        )

        scraper = self._StubScraper()
        with pytest.raises(RuntimeError, match="Boom!"):
            await scraper.fetch_content("https://example.com", mock_session)


# ===========================================================================
# 4. End-to-End Strategy Tests (mocked network)
# ===========================================================================

class TestHtmlSmartScraper:
    """Integration-style tests for HtmlSmartScraper.scrape()."""

    @pytest.mark.asyncio
    async def test_scrape_returns_correct_structure_on_success(self):
        """scrape() must return a dict with type='html' and status='success'.
        Phase 2 response shape: description + salary_hint keys.
        """
        html_body = "<html><body><h1>Test</h1></body></html>"

        mock_response = _make_mock_response(status=200, text_body=html_body)

        with patch("strategies.html_scraper.aiohttp.ClientSession") as MockSession:
            mock_ctx = MagicMock()
            mock_ctx.__aenter__ = AsyncMock(return_value=_make_mock_session(mock_response))
            mock_ctx.__aexit__ = AsyncMock(return_value=False)
            MockSession.return_value = mock_ctx

            scraper = HtmlSmartScraper()
            result = await scraper.scrape("https://example.com")

        assert result["type"] == "html"
        assert result["status"] == "success"
        # Phase 2 keys — description may be None for a trivial HTML snippet
        assert "description" in result
        assert "salary_hint" in result
        assert result["url"] == "https://example.com"

    @pytest.mark.asyncio
    async def test_scrape_returns_error_structure_on_failure(self):
        """scrape() must return status='error' when fetch_content raises."""
        http_err = aiohttp.ClientResponseError(
            request_info=MagicMock(), history=(), status=500, message="Server Error"
        )
        mock_response = _make_mock_response(raise_for_status_exc=http_err)

        with patch("strategies.html_scraper.aiohttp.ClientSession") as MockSession:
            mock_ctx = MagicMock()
            mock_ctx.__aenter__ = AsyncMock(return_value=_make_mock_session(mock_response))
            mock_ctx.__aexit__ = AsyncMock(return_value=False)
            MockSession.return_value = mock_ctx

            scraper = HtmlSmartScraper()
            result = await scraper.scrape("https://example.com")

        assert result["status"] == "error"
        assert result["description"] is None
        assert result["salary_hint"] is None
        assert "error" in result


class TestJsonApiScraper:
    """Integration-style tests for JsonApiScraper.scrape()."""

    @pytest.mark.asyncio
    async def test_scrape_returns_parsed_json_on_success(self):
        """scrape() must return the parsed JSON payload in 'content'."""
        api_payload = {"jobs": [{"id": 1, "title": "ML Engineer"}]}
        json_body = json.dumps(api_payload)

        mock_response = _make_mock_response(status=200, text_body=json_body)

        with patch("strategies.api_scraper.aiohttp.ClientSession") as MockSession:
            mock_ctx = MagicMock()
            mock_ctx.__aenter__ = AsyncMock(return_value=_make_mock_session(mock_response))
            mock_ctx.__aexit__ = AsyncMock(return_value=False)
            MockSession.return_value = mock_ctx

            scraper = JsonApiScraper()
            result = await scraper.scrape("https://api.example.com/jobs")

        assert result["type"] == "api"
        assert result["status"] == "success"
        assert result["content"] == api_payload

    @pytest.mark.asyncio
    async def test_scrape_returns_error_on_invalid_json(self):
        """scrape() must return status='error' when response body is not valid JSON."""
        mock_response = _make_mock_response(status=200, text_body="<not json>")

        with patch("strategies.api_scraper.aiohttp.ClientSession") as MockSession:
            mock_ctx = MagicMock()
            mock_ctx.__aenter__ = AsyncMock(return_value=_make_mock_session(mock_response))
            mock_ctx.__aexit__ = AsyncMock(return_value=False)
            MockSession.return_value = mock_ctx

            scraper = JsonApiScraper()
            result = await scraper.scrape("https://api.example.com/broken")

        assert result["status"] == "error"
        assert "JSON parse error" in result["error"]
