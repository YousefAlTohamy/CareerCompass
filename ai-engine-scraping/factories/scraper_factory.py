"""
factories/scraper_factory.py
=============================
Implements the Factory Pattern for instantiating scraper strategies.

Design Pattern: Factory Pattern
  - ScraperFactory decouples the caller from concrete Strategy classes.
  - Callers request a scraper by *type name* (a string); the factory
    decides which class to instantiate.
  - Adding a new scraper type (e.g., 'xml', 'graphql') requires only a
    change inside this factory — no changes in calling code.
"""

from __future__ import annotations

import logging

from core.base_scraper import BaseScraper
from strategies.api_scraper import JsonApiScraper
from strategies.html_scraper import HtmlSmartScraper

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Registry — maps string type keys to concrete strategy classes.
# Extend this dict to register new scrapers without touching get_scraper().
# ---------------------------------------------------------------------------
_SCRAPER_REGISTRY: dict[str, type[BaseScraper]] = {
    "html": HtmlSmartScraper,
    "api": JsonApiScraper,
}


class ScraperFactory:
    """
    Factory that creates and returns the correct BaseScraper strategy
    based on a ``source_type`` identifier string.

    Why a Factory?
    --------------
    Without a factory, client code would need explicit ``if/elif`` blocks
    and direct imports of every concrete class — tightly coupling the
    client to implementation details.  With a factory:

    * Clients depend only on the ``BaseScraper`` interface.
    * New strategy types can be registered in ``_SCRAPER_REGISTRY``
      without touching any existing code (Open/Closed Principle).
    * Testing is simpler — mock the factory, not every concrete class.

    Examples
    --------
    >>> scraper = ScraperFactory.get_scraper("html")
    >>> result  = await scraper.scrape("https://example.com")

    >>> scraper = ScraperFactory.get_scraper("api")
    >>> result  = await scraper.scrape("https://api.example.com/data")
    """

    @staticmethod
    def get_scraper(source_type: str) -> BaseScraper:
        """
        Instantiate and return the appropriate scraper strategy.

        Parameters
        ----------
        source_type : str
            A case-insensitive identifier for the desired strategy.
            Currently supported values: ``"html"``, ``"api"``.

        Returns
        -------
        BaseScraper
            A ready-to-use scraper instance.

        Raises
        ------
        ValueError
            If ``source_type`` does not map to any registered strategy.

        Examples
        --------
        >>> scraper = ScraperFactory.get_scraper("html")
        >>> isinstance(scraper, HtmlSmartScraper)
        True

        >>> ScraperFactory.get_scraper("unknown")
        ValueError: Unknown source type: 'unknown'. ...
        """
        normalised_type = source_type.strip().lower()

        scraper_class = _SCRAPER_REGISTRY.get(normalised_type)

        if scraper_class is None:
            supported = ", ".join(f"'{k}'" for k in _SCRAPER_REGISTRY)
            raise ValueError(
                f"Unknown source type: '{source_type}'. "
                f"Supported types are: [{supported}]."
            )

        logger.info(
            "[ScraperFactory] Creating scraper for type '%s' → %s",
            normalised_type,
            scraper_class.__name__,
        )
        return scraper_class()

    @staticmethod
    def registered_types() -> list[str]:
        """
        Return a sorted list of all registered scraper type keys.

        Useful for introspection, admin UIs, or dynamic documentation.

        Returns
        -------
        list[str]
            Sorted list of registered type identifiers.
        """
        return sorted(_SCRAPER_REGISTRY.keys())
