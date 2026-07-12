"""Unit tests for the cached news/analyst/price data provider.

get_cached_or_fetch itself is tested in test_market_data_cache_service.py;
here it's patched to just call through to fetch_fn so we can verify the
parsing/shaping logic on top of it in isolation.
"""

from datetime import datetime, timedelta

import pytest

from app.services import stock_of_the_day_data_provider as provider


@pytest.fixture(autouse=True)
def passthrough_cache(monkeypatch):
    """Route get_cached_or_fetch straight to fetch_fn (no real cache/DB)."""
    monkeypatch.setattr(
        provider,
        "get_cached_or_fetch",
        lambda provider, cache_key, ttl_seconds, fetch_fn, force_refresh=False: fetch_fn(),
    )


class TestGetNewsItemsForTicker:
    def test_parses_matching_ticker_sentiment(self, monkeypatch):
        raw = {
            "feed": [
                {
                    "time_published": "20260710T130000",
                    "ticker_sentiment": [
                        {"ticker": "AAPL", "ticker_sentiment_score": "0.35", "relevance_score": "0.8"},
                        {"ticker": "MSFT", "ticker_sentiment_score": "-0.1", "relevance_score": "0.9"},
                    ],
                }
            ]
        }
        monkeypatch.setattr(provider, "fetch_news_sentiment_raw", lambda ticker, **_: raw)

        items = provider.get_news_items_for_ticker("AAPL")

        assert len(items) == 1
        assert items[0]["sentiment_score"] == pytest.approx(0.35)
        assert items[0]["relevance_score"] == pytest.approx(0.8)
        assert items[0]["time_published"] == datetime(2026, 7, 10, 13, 0, 0)

    def test_skips_articles_without_ticker_match(self, monkeypatch):
        raw = {
            "feed": [
                {
                    "time_published": "20260710T130000",
                    "ticker_sentiment": [
                        {"ticker": "MSFT", "ticker_sentiment_score": "0.1", "relevance_score": "0.5"},
                    ],
                }
            ]
        }
        monkeypatch.setattr(provider, "fetch_news_sentiment_raw", lambda ticker, **_: raw)

        assert provider.get_news_items_for_ticker("AAPL") == []

    def test_skips_malformed_timestamp(self, monkeypatch):
        raw = {"feed": [{"time_published": "not-a-date", "ticker_sentiment": []}]}
        monkeypatch.setattr(provider, "fetch_news_sentiment_raw", lambda ticker, **_: raw)

        assert provider.get_news_items_for_ticker("AAPL") == []

    def test_empty_feed_returns_empty_list(self, monkeypatch):
        monkeypatch.setattr(provider, "fetch_news_sentiment_raw", lambda ticker, **_: {"feed": []})
        assert provider.get_news_items_for_ticker("AAPL") == []

    def test_provider_failure_degrades_to_empty_list_instead_of_raising(self, monkeypatch):
        def raise_error(*a, **k):
            raise provider.AlphaVantageError("rate limited")

        monkeypatch.setattr(provider, "get_cached_or_fetch", lambda *a, **k: raise_error())

        assert provider.get_news_items_for_ticker("AAPL") == []


class TestGetAnalystRevisionCounts:
    def test_counts_up_and_down_within_lookback(self, monkeypatch):
        now = datetime.now()
        rows = [
            {"grade_date": (now - timedelta(days=1)).isoformat(), "action": "up"},
            {"grade_date": (now - timedelta(days=2)).isoformat(), "action": "up"},
            {"grade_date": (now - timedelta(days=3)).isoformat(), "action": "down"},
            {"grade_date": (now - timedelta(days=3)).isoformat(), "action": "main"},
        ]
        monkeypatch.setattr(provider, "_fetch_analyst_actions_raw", lambda ticker: rows)

        upgrades, downgrades = provider.get_analyst_revision_counts("AAPL")

        assert upgrades == 2
        assert downgrades == 1

    def test_ignores_actions_outside_lookback_window(self, monkeypatch):
        now = datetime.now()
        rows = [
            {"grade_date": (now - timedelta(days=1)).isoformat(), "action": "up"},
            {"grade_date": (now - timedelta(days=30)).isoformat(), "action": "down"},
        ]
        monkeypatch.setattr(provider, "_fetch_analyst_actions_raw", lambda ticker: rows)

        upgrades, downgrades = provider.get_analyst_revision_counts("AAPL")

        assert upgrades == 1
        assert downgrades == 0

    def test_no_history_returns_zero_zero(self, monkeypatch):
        monkeypatch.setattr(provider, "_fetch_analyst_actions_raw", lambda ticker: [])
        assert provider.get_analyst_revision_counts("AAPL") == (0, 0)


class TestGetPriceHistory:
    def test_reconstructs_dataframe_from_cached_records(self, monkeypatch):
        records = {
            "records": [
                {"date": "2026-07-08T00:00:00", "close": 100.0, "volume": 1000.0},
                {"date": "2026-07-09T00:00:00", "close": 101.5, "volume": 1200.0},
            ]
        }
        monkeypatch.setattr(provider, "_fetch_price_history_raw", lambda ticker, period: records)

        df = provider.get_price_history("AAPL")

        assert list(df.columns) == ["Close", "Volume"]
        assert len(df) == 2
        assert df["Close"].iloc[-1] == pytest.approx(101.5)

    def test_empty_records_returns_empty_dataframe(self, monkeypatch):
        monkeypatch.setattr(provider, "_fetch_price_history_raw", lambda ticker, period: {"records": []})

        df = provider.get_price_history("AAPL")

        assert df.empty
        assert list(df.columns) == ["Close", "Volume"]
