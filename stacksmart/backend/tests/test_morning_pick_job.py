"""Unit tests for the daily Stock of the Day generation job."""

from datetime import date, datetime

import pandas as pd
import pytest

from app.jobs import morning_pick_job as job


def _price_history(prices, volumes=None):
    dates = pd.date_range("2026-01-01", periods=len(prices), freq="D")
    volumes = volumes or [1000] * len(prices)
    return pd.DataFrame({"Close": prices, "Volume": volumes}, index=dates)


class _FakeSelectQuery:
    def __init__(self, rows):
        self._rows = rows

    def select(self, *a, **k):
        return self

    def eq(self, *a, **k):
        return self

    def execute(self):
        return type("Result", (), {"data": self._rows})()


class _FakeUpsertQuery:
    def __init__(self, calls):
        self._calls = calls

    def upsert(self, payload, on_conflict=None):
        self._calls.append({"payload": payload, "on_conflict": on_conflict})
        return self

    def execute(self):
        return type("Result", (), {"data": [self._calls[-1]["payload"]]})()


class _FakeClient:
    """Routes .select(...) (existing-pick lookup) and .upsert(...) (write)
    against the same table name, matching how the real chain is used."""

    def __init__(self, calls, existing_pick_rows=None):
        self._calls = calls
        self._existing_pick_rows = existing_pick_rows or []

    def table(self, _name):
        return _FakeTable(self._calls, self._existing_pick_rows)


class _FakeTable:
    def __init__(self, calls, existing_pick_rows):
        self._calls = calls
        self._existing_pick_rows = existing_pick_rows

    def select(self, *a, **k):
        return _FakeSelectQuery(self._existing_pick_rows)

    def upsert(self, payload, on_conflict=None):
        return _FakeUpsertQuery(self._calls).upsert(payload, on_conflict=on_conflict)


class TestIsWithinExecutionWindow:
    def test_inside_window_is_true(self):
        now = datetime(2026, 7, 6, 10, 5, tzinfo=job.EASTERN)
        assert job.is_within_execution_window(now) is True

    def test_before_window_is_false(self):
        now = datetime(2026, 7, 6, 9, 30, tzinfo=job.EASTERN)
        assert job.is_within_execution_window(now) is False

    def test_after_window_is_false(self):
        now = datetime(2026, 7, 6, 11, 0, tzinfo=job.EASTERN)
        assert job.is_within_execution_window(now) is False

    def test_wrong_dst_offset_trigger_is_rejected(self):
        # A cron trigger firing at 14:05 UTC during EST (when it should have
        # fired at 15:05 UTC) lands at 9:05 ET, outside the window.
        from zoneinfo import ZoneInfo
        now_utc = datetime(2026, 1, 6, 14, 5, tzinfo=ZoneInfo("UTC"))  # EST in January
        assert job.is_within_execution_window(now_utc) is False


class TestRun:
    @pytest.fixture(autouse=True)
    def always_within_window(self, monkeypatch):
        """These tests aren't exercising the scheduling-window guard itself
        (that's TestIsWithinExecutionWindow above), so default it to True."""
        monkeypatch.setattr(job, "is_within_execution_window", lambda: True)

    def test_skips_on_non_trading_day(self, monkeypatch):
        monkeypatch.setattr(job, "is_trading_day", lambda d: False)
        called = []
        monkeypatch.setattr(job, "select_shortlist", lambda: called.append(1))

        assert job.run(pick_date=date(2026, 7, 4)) is None
        assert called == []

    def test_skips_outside_execution_window(self, monkeypatch):
        monkeypatch.setattr(job, "is_trading_day", lambda d: True)
        monkeypatch.setattr(job, "is_within_execution_window", lambda: False)
        called = []
        monkeypatch.setattr(job, "get_supabase_client", lambda: called.append(1))

        assert job.run(pick_date=date(2026, 7, 6)) is None
        assert called == []

    def test_raises_when_shortlist_empty(self, monkeypatch):
        monkeypatch.setattr(job, "is_trading_day", lambda d: True)
        monkeypatch.setattr(job, "select_shortlist", lambda: [])
        monkeypatch.setattr(job, "get_supabase_client", lambda: _FakeClient([]))

        with pytest.raises(job.MorningPickJobError):
            job.run(pick_date=date(2026, 7, 6))

    def test_raises_when_spy_fetch_fails(self, monkeypatch):
        monkeypatch.setattr(job, "is_trading_day", lambda d: True)
        monkeypatch.setattr(job, "select_shortlist", lambda: ["AAA"])
        monkeypatch.setattr(job, "get_supabase_client", lambda: _FakeClient([]))

        def raise_error(*a, **k):
            raise Exception("yfinance down")

        monkeypatch.setattr(job, "get_price_history", raise_error)

        with pytest.raises(job.MorningPickJobError):
            job.run(pick_date=date(2026, 7, 6))

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

    def test_existing_pick_is_returned_unchanged_without_force(self, monkeypatch):
        monkeypatch.setattr(job, "is_trading_day", lambda d: True)
        called = []
        monkeypatch.setattr(job, "select_shortlist", lambda: called.append(1))

        existing_row = {"pick_date": "2026-07-06", "ticker": "ZZZ", "composite_score": 0.5, "factor_breakdown": {}}
        calls = []
        monkeypatch.setattr(job, "get_supabase_client", lambda: _FakeClient(calls, existing_pick_rows=[existing_row]))

        result = job.run(pick_date=date(2026, 7, 6))

        assert result == existing_row
        assert called == []  # never even got to computing a new pick
        assert calls == []  # never wrote anything

    def test_force_recomputes_even_when_pick_exists(self, monkeypatch):
        monkeypatch.setattr(job, "is_trading_day", lambda d: True)
        monkeypatch.setattr(job, "select_shortlist", lambda: ["AAA"])

        spy_history = _price_history([100 + i * 0.1 for i in range(30)])
        monkeypatch.setattr(
            job,
            "get_price_history",
            lambda t, period="3mo": spy_history if t == "SPY" else _price_history([100 + i for i in range(30)]),
        )
        monkeypatch.setattr(job, "get_analyst_revision_counts", lambda t: (0, 0))
        monkeypatch.setattr(job, "get_news_items_for_ticker", lambda t: [])

        existing_row = {"pick_date": "2026-07-06", "ticker": "ZZZ", "composite_score": 0.5, "factor_breakdown": {}}
        calls = []
        monkeypatch.setattr(job, "get_supabase_client", lambda: _FakeClient(calls, existing_pick_rows=[existing_row]))

        result = job.run(pick_date=date(2026, 7, 6), force=True)

        assert result["ticker"] == "AAA"
        assert len(calls) == 1

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
