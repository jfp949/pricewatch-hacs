"""Async price fetcher using web search for PriceWatch."""
from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import datetime

import aiohttp
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

# Australian retailers to prioritise in search
AU_RETAILERS = [
    "JB Hi-Fi", "Harvey Norman", "Amazon AU", "Officeworks",
    "The Good Guys", "Kogan", "Myer", "Big W", "Target AU", "Costco AU",
]

SEARCH_PROMPT_TEMPLATE = """
You are a price comparison assistant for Australian retail. Find current prices for: "{product}"

Search major Australian retailers: JB Hi-Fi, Harvey Norman, Amazon.com.au, Officeworks, The Good Guys, Kogan, Myer, Big W, Costco.

Return ONLY valid JSON (no markdown, no preamble):
{{
  "product": "full product name with model",
  "currency": "AUD",
  "timestamp": "{timestamp}",
  "results": [
    {{"store": "Store Name", "price": 999.00, "name": "Exact product name", "url": "https://..."}}
  ]
}}

Sort results cheapest first. Include 4-6 stores. Use real current Australian market prices.
"""


class PriceFetcher:
    """Handles async price retrieval via Anthropic API with web search."""

    ANTHROPIC_API = "https://api.anthropic.com/v1/messages"
    MODEL = "claude-sonnet-4-20250514"

    def __init__(self, hass: HomeAssistant):
        self.hass = hass
        self._session: aiohttp.ClientSession | None = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session

    async def get_cheapest_price(self, product: str) -> dict:
        """
        Query Anthropic with web search tool to find current AU prices.
        Returns dict with cheapest_price, store, results[], timestamp.
        """
        timestamp = datetime.now().isoformat()
        prompt = SEARCH_PROMPT_TEMPLATE.format(product=product, timestamp=timestamp)

        payload = {
            "model": self.MODEL,
            "max_tokens": 1024,
            "tools": [{"type": "web_search_20250305", "name": "web_search"}],
            "messages": [{"role": "user", "content": prompt}],
        }

        try:
            session = await self._get_session()
            async with session.post(
                self.ANTHROPIC_API,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                if resp.status != 200:
                    _LOGGER.error("Anthropic API error: %s", resp.status)
                    return self._empty_result(product, timestamp)

                data = await resp.json()

        except asyncio.TimeoutError:
            _LOGGER.warning("Price fetch timed out for: %s", product)
            return self._empty_result(product, timestamp)
        except aiohttp.ClientError as err:
            _LOGGER.error("HTTP error fetching prices: %s", err)
            return self._empty_result(product, timestamp)

        # Extract text blocks from response
        text_content = " ".join(
            block.get("text", "")
            for block in data.get("content", [])
            if block.get("type") == "text"
        )

        # Parse JSON from response
        parsed = self._extract_json(text_content)
        if not parsed or not parsed.get("results"):
            _LOGGER.warning("Could not parse price data for: %s", product)
            return self._empty_result(product, timestamp)

        results = sorted(parsed["results"], key=lambda x: x.get("price", 9999))
        cheapest = results[0] if results else {}

        return {
            "product": parsed.get("product", product),
            "cheapest_price": cheapest.get("price"),
            "store": cheapest.get("store"),
            "timestamp": parsed.get("timestamp", timestamp),
            "results": results,
            "currency": parsed.get("currency", "AUD"),
        }

    def _extract_json(self, text: str) -> dict | None:
        """Extract JSON object from a text string."""
        text = re.sub(r"```json|```", "", text).strip()
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
        return None

    def _empty_result(self, product: str, timestamp: str) -> dict:
        return {
            "product": product,
            "cheapest_price": None,
            "store": None,
            "timestamp": timestamp,
            "results": [],
            "currency": "AUD",
        }

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()
