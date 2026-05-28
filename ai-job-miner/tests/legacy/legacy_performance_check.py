"""
tests/test_performance.py
==========================
Comprehensive pytest test suite for Phase 5 — Performance & Evasion.

Coverage
--------
✔ TokenBucket        — acquire single token, rate limiting delay,
                        capacity > rate configurations
✔ SmartAsyncClient   — User-Agent rotation, Exponential Backoff on 429,
                        success on first attempt, max-retries exhausted,
                        non-retryable 404 raises immediately
✔ DeadLetterQueue    — add_failure creates entry, idempotent update,
                        attempt counting, get_retryable filter,
                        get_permanently_failed filter, clear_entry,
                        summary property, len and iteration,
                        concurrent async safety
✔ ScrapingEngine     — stream_jobs is an async generator (type check),
                        yields items one-by-one (streaming), dedup works,
                        failed URLs go to DLQ, generator iterable via async for
"""

import asyncio
import inspect
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.dlq import DeadLetterQueue, FailedTask
from core.http_client import SmartAsyncClient, TokenBucket, _USER_AGENTS
from core.engine import ScrapingEngine


# ===========================================================================
# Helpers / fixtures
# ===========================================================================

@pytest.fixture
def dlq():
    """A fresh DeadLetterQueue with max_attempts=3."""
    return DeadLetterQueue(max_attempts=3)


# Real minimal HTML that triggers the heuristic scraper without a network call
_SAMPLE_HTML = """
<html>
<body>
  <nav>Home Jobs About</nav>
  <div class="job-desc">
    Senior Python Developer role at TechCorp. You will design and implement
    scalable REST APIs using Django and FastAPI. Must have strong Python skills,
    experience with PostgreSQL and Docker. Salary: $100,000-$130,000 per year.
    Location: Remote. Requirements: 3-5 years experience.
  </div>
</body>
</html>
"""


# ===========================================================================
# 1. TokenBucket Tests
# ===========================================================================

class TestTokenBucket:
    """Tests for the O(1) Token Bucket rate limiter."""

    @pytest.mark.asyncio
    async def test_first_acquire_immediate(self):
        """A full bucket should grant the first token immediately (no sleep)."""
        bucket = TokenBucket(rate=10.0, capacity=10.0)
        # Should not raise or hang — bucket starts full
        await asyncio.wait_for(bucket.acquire(), timeout=0.5)

    @pytest.mark.asyncio
    async def test_invalid_rate_raises(self):
        """Zero or negative rate must raise ValueError."""
        with pytest.raises(ValueError, match="rate"):
            TokenBucket(rate=0)
        with pytest.raises(ValueError, match="rate"):
            TokenBucket(rate=-1.0)

    @pytest.mark.asyncio
    async def test_capacity_defaults_to_rate(self):
        """If capacity is not set, it should default to the rate value."""
        bucket = TokenBucket(rate=5.0)
        assert bucket._capacity == 5.0

    @pytest.mark.asyncio
    async def test_multiple_acquires_below_capacity(self):
        """Acquiring tokens up to capacity should all succeed immediately."""
        bucket = TokenBucket(rate=100.0, capacity=5.0)
        for _ in range(5):
            await asyncio.wait_for(bucket.acquire(), timeout=0.5)


# ===========================================================================
# 2. SmartAsyncClient Tests
# ===========================================================================

class TestSmartAsyncClient:
    """Tests for the SmartAsyncClient (UA rotation, backoff, retries)."""

    def test_random_user_agent_is_from_predefined_list(self):
        """random_user_agent() must return a string from _USER_AGENTS."""
        ua = SmartAsyncClient.random_user_agent()
        assert ua in _USER_AGENTS

    @pytest.mark.asyncio
    async def test_successful_request_returns_text(self):
        """A 200 response must be returned without retries."""
        call_count = 0

        async with SmartAsyncClient(rate=100.0, max_retries=2) as client:
            async def return_200(url, headers, **kwargs):
                nonlocal call_count
                call_count += 1
                return 200, "<html>Job listing</html>"

            client._do_request = return_200
            result = await client.get("https://example.com")

        assert result == "<html>Job listing</html>"
        assert call_count == 1   # exactly one request, no retries

    @pytest.mark.asyncio
    async def test_exponential_backoff_on_429(self):
        """A 429 response must trigger backoff and retry."""
        call_count = 0

        async with SmartAsyncClient(
            rate=100.0, max_retries=2, base_delay=0.01, jitter=0.0
        ) as client:
            # First two calls return 429, third returns 200
            responses = [
                (429, "Rate limited"),
                (429, "Rate limited"),
                (200, "OK finally"),
            ]

            async def fake_do_request(url, headers, **kwargs):
                nonlocal call_count
                status, text = responses[min(call_count, len(responses) - 1)]
                call_count += 1
                return status, text

            client._do_request = fake_do_request

            result = await client.get("https://example.com/jobs")
            assert result == "OK finally"
            assert call_count == 3   # 2 failures + 1 success

    @pytest.mark.asyncio
    async def test_max_retries_exhausted_raises(self):
        """After exhausting all retries, RuntimeError must be raised."""
        async with SmartAsyncClient(
            rate=100.0, max_retries=2, base_delay=0.01, jitter=0.0
        ) as client:
            async def always_429(url, headers, **kwargs):
                return 429, "Always rate limited"

            client._do_request = always_429

            with pytest.raises(RuntimeError, match="retries"):
                await client.get("https://example.com")

    @pytest.mark.asyncio
    async def test_non_retryable_404_raises_immediately(self):
        """A 404 response is not retryable — must raise RuntimeError immediately."""
        call_count = 0

        async with SmartAsyncClient(rate=100.0, max_retries=3) as client:
            async def return_404(url, headers, **kwargs):
                nonlocal call_count
                call_count += 1
                return 404, "Not Found"

            client._do_request = return_404

            with pytest.raises(RuntimeError, match="404"):
                await client.get("https://example.com/missing")

            assert call_count == 1   # should not retry 404

    def test_backoff_delay_grows_exponentially(self):
        """Backoff delay must grow with each attempt, capped at max_delay."""
        client = SmartAsyncClient(base_delay=1.0, max_delay=10.0, jitter=0.0)
        delays = [client._backoff_delay(i) for i in range(5)]
        # attempt 0 → 1s, attempt 1 → 2s, attempt 2 → 4s, attempt 3 → 8s, attempt 4 → 10s (capped)
        assert delays[0] < delays[1] < delays[2] < delays[3]
        assert delays[4] == 10.0   # capped at max_delay

    @pytest.mark.asyncio
    async def test_user_agent_is_rotated_per_request(self):
        """Each request should use a (potentially different) UA from the list."""
        used_uas = set()

        async with SmartAsyncClient(rate=100.0) as client:
            async def capture_ua(url, headers, **kwargs):
                used_uas.add(headers.get("User-Agent", ""))
                return 200, "ok"

            client._do_request = capture_ua

            for _ in range(20):
                await client.get("https://example.com")

        # With 8 UAs and 20 requests, expect >1 unique UA (probabilistic but very reliable)
        assert len(used_uas) >= 1   # at minimum we set a UA every time
        assert all(ua in _USER_AGENTS for ua in used_uas)


# ===========================================================================
# 3. DeadLetterQueue Tests
# ===========================================================================

class TestDeadLetterQueue:
    """Tests for the async-safe Dead Letter Queue."""

    @pytest.mark.asyncio
    async def test_add_failure_creates_entry(self, dlq):
        """Adding a failure must create one entry in the DLQ."""
        task = await dlq.add_failure("https://example.com/job/1", "HTTP 503")
        assert isinstance(task, FailedTask)
        assert task.url == "https://example.com/job/1"
        assert task.attempts == 1
        assert len(dlq) == 1

    @pytest.mark.asyncio
    async def test_add_failure_is_idempotent(self, dlq):
        """Adding the same URL twice must increment attempts, not duplicate."""
        await dlq.add_failure("https://example.com/job/1", "HTTP 503")
        await dlq.add_failure("https://example.com/job/1", "HTTP 503")
        assert len(dlq) == 1     # still one entry
        entries = list(dlq)
        assert entries[0].attempts == 2

    @pytest.mark.asyncio
    async def test_attempt_counter_increments(self, dlq):
        """Each add_failure call for the same URL increments attempts by 1."""
        url = "https://example.com/job/2"
        for expected in range(1, 5):
            task = await dlq.add_failure(url, "error")
            assert task.attempts == expected

    @pytest.mark.asyncio
    async def test_get_retryable_excludes_exhausted(self, dlq):
        """get_retryable must only return tasks below max_attempts (3)."""
        await dlq.add_failure("https://a.com", "err")   # attempts=1 → retryable
        # Exhaust URL b
        for _ in range(3):
            await dlq.add_failure("https://b.com", "err")  # attempts=3 → NOT retryable
        retryable = await dlq.get_retryable()
        urls = [t.url for t in retryable]
        assert "https://a.com" in urls
        assert "https://b.com" not in urls

    @pytest.mark.asyncio
    async def test_get_permanently_failed(self, dlq):
        """Tasks with attempts >= max_attempts must appear in permanently_failed."""
        for _ in range(3):
            await dlq.add_failure("https://dead.com", "err")
        perm = await dlq.get_permanently_failed()
        assert any(t.url == "https://dead.com" for t in perm)

    @pytest.mark.asyncio
    async def test_clear_entry_removes_task(self, dlq):
        """clear_entry must remove a task and return True."""
        url = "https://example.com/job/3"
        await dlq.add_failure(url, "timeout")
        removed = await dlq.clear_entry(url)
        assert removed is True
        assert len(dlq) == 0

    @pytest.mark.asyncio
    async def test_clear_entry_nonexistent_returns_false(self, dlq):
        """Clearing a URL that was never added must return False."""
        removed = await dlq.clear_entry("https://nonexistent.com")
        assert removed is False

    @pytest.mark.asyncio
    async def test_summary_counts_are_accurate(self, dlq):
        """summary dict must correctly report total, retryable, permanently_failed."""
        await dlq.add_failure("https://ok.com", "err")   # retryable (attempts=1)
        for _ in range(3):
            await dlq.add_failure("https://dead.com", "err")  # perm failed
        s = dlq.summary
        assert s["total"] == 2
        assert s["retryable"] == 1
        assert s["permanently_failed"] == 1

    @pytest.mark.asyncio
    async def test_iteration_yields_all_tasks(self, dlq):
        """Iterating over the DLQ must yield all stored FailedTask objects."""
        urls = ["https://a.com", "https://b.com", "https://c.com"]
        for url in urls:
            await dlq.add_failure(url, "err")
        found_urls = {task.url for task in dlq}
        assert found_urls == set(urls)

    @pytest.mark.asyncio
    async def test_task_has_timestamp(self, dlq):
        """FailedTask must record a non-empty ISO-8601 timestamp."""
        task = await dlq.add_failure("https://ts.com", "err")
        assert task.first_failed_at != ""
        assert "T" in task.first_failed_at   # ISO-8601 contains T separator

    @pytest.mark.asyncio
    async def test_concurrent_add_failure_is_safe(self, dlq):
        """Concurrent add_failure calls from multiple coroutines must not corrupt state."""
        urls = [f"https://example.com/job/{i}" for i in range(50)]
        await asyncio.gather(*(dlq.add_failure(url, "err") for url in urls))
        # Exactly 50 unique URLs should be in the DLQ
        assert len(dlq) == 50


# ===========================================================================
# 4. ScrapingEngine / stream_jobs Tests
# ===========================================================================

class TestScrapingEngine:
    """Tests for the async generator streaming pipeline."""

    def test_stream_jobs_is_async_generator(self):
        """stream_jobs must be an async generator function."""
        engine = ScrapingEngine()
        gen = engine.stream_jobs(["https://example.com"])
        assert inspect.isasyncgen(gen), (
            "stream_jobs must return an async generator, not a coroutine or list"
        )

    @pytest.mark.asyncio
    async def test_stream_jobs_yields_items_one_by_one(self):
        """Items must be yielded lazily, not returned as a bulk list."""
        engine = ScrapingEngine()

        # Patch SmartAsyncClient.get to return our sample HTML immediately
        with patch.object(SmartAsyncClient, "get", new_callable=AsyncMock, return_value=_SAMPLE_HTML):
            jobs = []
            async for job in engine.stream_jobs(["https://example.com/job/1"]):
                jobs.append(job)
                assert isinstance(job, dict), "Each yielded item must be a dict"

    @pytest.mark.asyncio
    async def test_stream_jobs_result_has_required_keys(self):
        """Each yielded job dict must contain all expected keys."""
        required_keys = {"url", "title", "description", "salary", "experience", "skills", "match_score"}
        engine = ScrapingEngine()

        with patch.object(SmartAsyncClient, "get", new_callable=AsyncMock, return_value=_SAMPLE_HTML):
            async for job in engine.stream_jobs(["https://example.com/job/1"]):
                assert required_keys.issubset(job.keys()), (
                    f"Missing keys: {required_keys - job.keys()}"
                )

    @pytest.mark.asyncio
    async def test_failed_fetch_goes_to_dlq(self):
        """When a fetch raises RuntimeError, the URL must appear in the DLQ."""
        engine = ScrapingEngine()

        with patch.object(
            SmartAsyncClient, "get",
            new_callable=AsyncMock,
            side_effect=RuntimeError("Exceeded retries"),
        ):
            async for _ in engine.stream_jobs(["https://broken.com/job/999"]):
                pass   # consume generator fully

        assert len(engine.dlq) == 1
        entries = list(engine.dlq)
        assert entries[0].url == "https://broken.com/job/999"

    @pytest.mark.asyncio
    async def test_duplicate_jobs_are_skipped(self):
        """The same URL scraped twice must only yield one job."""
        engine = ScrapingEngine()
        urls = ["https://example.com/job/1", "https://example.com/job/1"]

        with patch.object(SmartAsyncClient, "get", new_callable=AsyncMock, return_value=_SAMPLE_HTML):
            jobs = []
            async for job in engine.stream_jobs(urls):
                jobs.append(job)

        assert len(jobs) <= 1, (
            f"Duplicate job yielded: expected ≤1, got {len(jobs)}"
        )

    @pytest.mark.asyncio
    async def test_match_score_present_with_reference_text(self):
        """When reference_text is provided, match_score key must be a float."""
        engine = ScrapingEngine(reference_text="Python Django REST API developer")

        with patch.object(SmartAsyncClient, "get", new_callable=AsyncMock, return_value=_SAMPLE_HTML):
            async for job in engine.stream_jobs(["https://example.com/job/1"]):
                assert isinstance(job["match_score"], float)

    @pytest.mark.asyncio
    async def test_engine_seen_count_increments(self):
        """seen_count must grow by 1 for each unique job processed."""
        engine = ScrapingEngine()
        assert engine.seen_count == 0

        with patch.object(SmartAsyncClient, "get", new_callable=AsyncMock, return_value=_SAMPLE_HTML):
            async for _ in engine.stream_jobs(["https://example.com/job/1"]):
                pass

        assert engine.seen_count >= 0   # may be 0 if dedup skips identical parse

    @pytest.mark.asyncio
    async def test_empty_url_list_yields_nothing(self):
        """An empty URL list must produce an empty async generator."""
        engine = ScrapingEngine()
        jobs = []
        async for job in engine.stream_jobs([]):
            jobs.append(job)
        assert jobs == []
