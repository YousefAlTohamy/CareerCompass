"""
ai/llm_client.py
================
Thin async wrapper around LLM providers for Phase 3 fallback extraction.

Supported providers:
- OpenAI (official SDK)
- Ollama (local HTTP API)
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from typing import Any, Literal, Optional

import aiohttp

logger = logging.getLogger(__name__)

Provider = Literal["openai", "ollama", "disabled"]


@dataclass(frozen=True)
class LlmConfig:
    provider: Provider
    model: str
    openai_api_key: str | None
    openai_base_url: str | None
    ollama_base_url: str
    timeout_s: int
    max_calls_per_run: int

    @staticmethod
    def from_env() -> "LlmConfig":
        provider = os.getenv("LLM_PROVIDER", "disabled").strip().lower()
        if provider not in ("openai", "ollama", "disabled"):
            provider = "disabled"

        return LlmConfig(
            provider=provider,  # type: ignore[arg-type]
            model=os.getenv("LLM_MODEL", "gpt-4o-mini"),
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            openai_base_url=os.getenv("OPENAI_BASE_URL"),
            ollama_base_url=os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
            timeout_s=int(os.getenv("LLM_TIMEOUT_S", "30")),
            max_calls_per_run=int(os.getenv("LLM_MAX_CALLS_PER_RUN", "25")),
        )


class LlmClient:
    def __init__(self, config: LlmConfig) -> None:
        self._cfg = config
        self._calls = 0

    @property
    def enabled(self) -> bool:
        return self._cfg.provider != "disabled"

    def _can_call(self) -> bool:
        return self._calls < self._cfg.max_calls_per_run

    async def extract_json(self, prompt: str) -> dict[str, Any] | None:
        if not self.enabled:
            return None
        if not self._can_call():
            logger.warning("[LLM] Call budget exceeded; skipping fallback.")
            return None

        self._calls += 1

        if self._cfg.provider == "openai":
            return await self._openai_json(prompt)
        if self._cfg.provider == "ollama":
            return await self._ollama_json(prompt)
        return None

    async def _openai_json(self, prompt: str) -> dict[str, Any] | None:
        try:
            from openai import AsyncOpenAI  # type: ignore

            client = AsyncOpenAI(
                api_key=self._cfg.openai_api_key,
                base_url=self._cfg.openai_base_url,
            )

            resp = await client.chat.completions.create(
                model=self._cfg.model,
                temperature=0,
                messages=[
                    {"role": "system", "content": "You extract structured fields from job posting HTML/text."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
            )
            content = resp.choices[0].message.content or ""
            return json.loads(content) if content else None
        except Exception as exc:  # noqa: BLE001
            logger.error("[LLM:openai] Failed: %s", exc)
            return None

    async def _ollama_json(self, prompt: str) -> dict[str, Any] | None:
        # Ollama "chat" API returns content as string; we ask for strict JSON.
        url = self._cfg.ollama_base_url.rstrip("/") + "/api/chat"

        payload = {
            "model": self._cfg.model,
            "messages": [
                {"role": "system", "content": "You extract structured fields from job posting HTML/text."},
                {"role": "user", "content": prompt},
            ],
            "stream": False,
            "options": {"temperature": 0},
        }

        timeout = aiohttp.ClientTimeout(total=self._cfg.timeout_s)
        try:
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(url, json=payload) as resp:
                    resp.raise_for_status()
                    data = await resp.json()
                    text = ((data.get("message") or {}).get("content")) or ""
                    text = text.strip()
                    if not text:
                        return None
                    return json.loads(text)
        except Exception as exc:  # noqa: BLE001
            logger.error("[LLM:ollama] Failed: %s", exc)
            return None

