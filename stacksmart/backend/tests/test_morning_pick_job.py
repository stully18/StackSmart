"""Unit tests for the daily Stock of the Day generation job."""

from datetime import date

import pandas as pd

from app.jobs import morning_pick_job as job


def _price_history(prices, volumes=None):
    dates = pd.date_range("2026-01-01", periods=len(prices), freq="D")
    volumes = volumes or [1000] * len(prices)
    return pd.DataFrame({"Close": prices, "Volume": volumes}, index=dates)


class _FakeUpsertQuery:
    def __init__(self, calls):
        self._calls = calls

    def upsert(self, payload, on_conflict=None):
        self._calls.append({"payload": payload, "on_conflict": on_conflict})
        return self

    def execute(self):
        return type("Result", (), {"data": [self._calls[-1]["payload"]]})()


class _FakeClient:
    def __init__(self, calls):
        self._calls = calls

    def table(self, _name):
        return _FakeUpsertQuery(self._calls)


class TestRun:
    def test_skips_on_non_trading_day(self, monkeypatch):
        monkeypatch.setattr(job, "is_trading_day", lambda d: False)
        called = []
        monkeypatch.setattr(job, "select_shortlist", lambda: called.append(1))

        assert job.run(pick_date=date(2026, 7, 4)) is None
        assert called == []

    def test_aborts_when_shortlist_empty(self, monkeypatch):
        monkeypatch.setattr(job, "is_trading_day", lambda d: True)
        monkeypatch.setattr(job, "select_shortlist", lambda: [])

        assert job.run(pick_date=date(2026, 7, 6)) is None

    def test_happy_path_picks_highest_scorer_and_upserts(self, monkeypatch):
        monkeypatch.setattr(job, "is_trading_day", lambda d: True)
        monkeypatch.setattr(job, "select_shortlist", lambda: ["AAA", "BBB"])

        spy_history = _price_history([100 + i * 0.1 for i in range(30)])

        def fake_price_history(ticker, period="3mo"):
            if ticker == "SPY":
                return spy_history
            if ticker == "AAA":
                return _price_history([100 + i * 3 for i in range(30)])
            return _price_history([100 + i * 0.1 for i in range(30)])

        monkeypatch.setattr(job, "get_price_history", fake_price_history)
        monkeypatch.setattr(job, "get_analyst_revision_counts", lambda t: (0, 0))
        monkeypatch.setattr(job, "get_news_items_for_ticker", lambda t: [])

        calls = []
        monkeypatch.setattr(job, "get_supabase_client", lambda: _FakeClient(calls))

        result = job.run(pick_date=date(2026, 7, 6))

        assert result["ticker"] == "AAA"
        assert len(calls) == 1
        assert calls[0]["payload"]["pick_date"] == "2026-07-06"
        assert calls[0]["on_conflict"] == "pick_date"

    def test_ticker_with_broken_price_history_is_skipped_not_fatal(self, monkeypatch):
        monkeypatch.setattr(job, "is_trading_day", lambda d: True)
        monkeypatch.setattr(job, "select_shortlist", lambda: ["AAA", "BROKEN"])

        spy_history = _price_history([100 + i * 0.1 for i in range(30)])

        def fake_price_history(ticker, period="3mo"):
            if ticker == "SPY":
                return spy_history
            if ticker == "BROKEN":
                raise Exception("yfinance is down")
            return _price_history([100 + i * 2 for i in range(30)])

        monkeypatch.setattr(job, "get_price_history", fake_price_history)
        monkeypatch.setattr(job, "get_analyst_revision_counts", lambda t: (0, 0))
        monkeypatch.setattr(job, "get_news_items_for_ticker", lambda t: [])
        monkeypatch.setattr(job, "get_supabase_client", lambda: _FakeClient([]))

        result = job.run(pick_date=date(2026, 7, 6))

        assert result["ticker"] == "AAA"

    def test_analyst_fetch_failure_degrades_factor_not_whole_ticker(self, monkeypatch):
        monkeypatch.setattr(job, "is_trading_day", lambda d: True)
        monkeypatch.setattr(job, "select_shortlist", lambda: ["AAA"])

        spy_history = _price_history([100 + i * 0.1 for i in range(30)])
        monkeypatch.setattr(
            job,
            "get_price_history",
            lambda t, period="3mo": spy_history if t == "SPY" else _price_history([100 + i for i in range(30)]),
        )

        def raise_analyst(t):
            raise Exception("yfinance analyst endpoint down")

        monkeypatch.setattr(job, "get_analyst_revision_counts", raise_analyst)
        monkeypatch.setattr(job, "get_news_items_for_ticker", lambda t: [])
        monkeypatch.setattr(job, "get_supabase_client", lambda: _FakeClient([]))

        result = job.run(pick_date=date(2026, 7, 6))

        assert result["ticker"] == "AAA"
        assert result["factor_breakdown"]["analyst_revision"]["raw_value"] is None
