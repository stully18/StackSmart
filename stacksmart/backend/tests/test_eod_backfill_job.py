"""Unit tests for the EOD performance backfill job."""

from datetime import date

import pandas as pd
import pytest

from app.jobs import eod_backfill_job as job


class _FakePicksQuery:
    def __init__(self, rows):
        self._rows = rows

    def select(self, *a, **k):
        return self

    def order(self, *a, **k):
        return self

    def limit(self, *a, **k):
        return self

    def execute(self):
        return type("Result", (), {"data": self._rows})()


class _FakePerformanceSelectQuery:
    def __init__(self, rows_by_date):
        self._rows_by_date = rows_by_date
        self._filter_date = None

    def select(self, *a, **k):
        return self

    def eq(self, _col, value):
        self._filter_date = value
        return self

    def execute(self):
        row = self._rows_by_date.get(self._filter_date)
        return type("Result", (), {"data": [row] if row else []})()


class _FakeUpsertQuery:
    def __init__(self, calls):
        self._calls = calls

    def upsert(self, payload, on_conflict=None):
        self._calls.append({"payload": payload, "on_conflict": on_conflict})
        return self

    def execute(self):
        return type("Result", (), {"data": None})()


class _FakeClient:
    def __init__(self, picks_rows, performance_rows_by_date, upsert_calls):
        self._picks_rows = picks_rows
        self._performance_rows_by_date = performance_rows_by_date
        self._upsert_calls = upsert_calls

    def table(self, name):
        if name == "stock_of_the_day_picks":
            return _FakePicksQuery(self._picks_rows)
        if name == "stock_of_the_day_performance":
            return _FakePerformanceTable(self._performance_rows_by_date, self._upsert_calls)
        raise AssertionError(f"unexpected table {name}")


class _FakePerformanceTable:
    def __init__(self, rows_by_date, upsert_calls):
        self._rows_by_date = rows_by_date
        self._upsert_calls = upsert_calls

    def select(self, *a, **k):
        return _FakePerformanceSelectQuery(self._rows_by_date)

    def upsert(self, payload, on_conflict=None):
        return _FakeUpsertQuery(self._upsert_calls).upsert(payload, on_conflict=on_conflict)


def _flat_spy_history(as_of, periods=30):
    dates = pd.bdate_range(end=as_of, periods=periods)
    return pd.DataFrame({"Close": [200.0] * periods}, index=dates)


class TestRun:
    def test_backfills_windows_that_have_elapsed_and_skips_ones_that_havent(self, monkeypatch):
        pick_date_iso = "2026-06-01"
        dates = pd.bdate_range("2026-06-01", periods=25)
        ticker_prices = [100 + i for i in range(25)]
        spy_prices = [200 + i * 0.5 for i in range(25)]
        ticker_history = pd.DataFrame({"Close": ticker_prices}, index=dates)
        spy_history = pd.DataFrame({"Close": spy_prices}, index=dates)

        as_of = dates[10].date()  # only 10 trading days elapsed since pick_date

        def fake_price_history(ticker, period="3mo", force_refresh=False):
            assert force_refresh is True  # EOD must always bypass the cache
            full = spy_history if ticker == "SPY" else ticker_history
            return full[full.index.date <= as_of]

        monkeypatch.setattr(job, "get_price_history", fake_price_history)

        upsert_calls = []
        client = _FakeClient(
            picks_rows=[{"pick_date": pick_date_iso, "ticker": "AAA"}],
            performance_rows_by_date={},
            upsert_calls=upsert_calls,
        )
        monkeypatch.setattr(job, "get_supabase_client", lambda: client)

        written = job.run(as_of=as_of)

        assert written == 1
        payload = upsert_calls[0]["payload"]
        assert payload["pick_date"] == pick_date_iso
        assert payload["price_at_pick"] == pytest.approx(100.0)
        assert payload["return_1d"] == pytest.approx(0.01)
        assert payload["return_5d"] == pytest.approx(0.05)
        assert "return_20d" not in payload

    def test_pick_made_today_is_skipped(self, monkeypatch):
        as_of = date(2026, 6, 1)
        client = _FakeClient(
            picks_rows=[{"pick_date": as_of.isoformat(), "ticker": "AAA"}],
            performance_rows_by_date={},
            upsert_calls=[],
        )
        monkeypatch.setattr(job, "get_supabase_client", lambda: client)
        # SPY is still fetched once up front regardless; only a per-ticker
        # fetch for "AAA" would indicate the skip logic didn't fire.
        monkeypatch.setattr(
            job,
            "get_price_history",
            lambda ticker, period="3mo", force_refresh=False: _flat_spy_history(as_of)
            if ticker == "SPY"
            else pytest.fail("should not fetch a skipped ticker's history"),
        )

        written = job.run(as_of=as_of)

        assert written == 0

    def test_fully_backfilled_pick_is_skipped(self, monkeypatch):
        pick_date_iso = "2026-05-01"
        as_of = date(2026, 7, 1)
        existing_row = {
            "pick_date": pick_date_iso,
            "return_1d": 0.01,
            "return_5d": 0.02,
            "return_20d": 0.03,
        }
        upsert_calls = []
        client = _FakeClient(
            picks_rows=[{"pick_date": pick_date_iso, "ticker": "AAA"}],
            performance_rows_by_date={pick_date_iso: existing_row},
            upsert_calls=upsert_calls,
        )
        monkeypatch.setattr(job, "get_supabase_client", lambda: client)
        monkeypatch.setattr(
            job,
            "get_price_history",
            lambda ticker, period="3mo", force_refresh=False: _flat_spy_history(as_of)
            if ticker == "SPY"
            else pytest.fail("should not fetch a fully-backfilled ticker's history"),
        )

        written = job.run(as_of=as_of)

        assert written == 0
        assert upsert_calls == []

    def test_price_fetch_failure_for_one_ticker_does_not_crash(self, monkeypatch):
        as_of = date(2026, 6, 15)
        upsert_calls = []
        client = _FakeClient(
            picks_rows=[{"pick_date": "2026-06-01", "ticker": "BROKEN"}],
            performance_rows_by_date={},
            upsert_calls=upsert_calls,
        )
        monkeypatch.setattr(job, "get_supabase_client", lambda: client)

        def fake_price_history(ticker, period="3mo", force_refresh=False):
            if ticker == "SPY":
                return _flat_spy_history(as_of)
            raise Exception("yfinance is down for this ticker")

        monkeypatch.setattr(job, "get_price_history", fake_price_history)

        written = job.run(as_of=as_of)

        assert written == 0

    def test_spy_fetch_failure_propagates_and_does_not_report_success(self, monkeypatch):
        client = _FakeClient(
            picks_rows=[{"pick_date": "2026-06-01", "ticker": "AAA"}],
            performance_rows_by_date={},
            upsert_calls=[],
        )
        monkeypatch.setattr(job, "get_supabase_client", lambda: client)

        def raise_error(*a, **k):
            raise Exception("yfinance is down")

        monkeypatch.setattr(job, "get_price_history", raise_error)

        with pytest.raises(Exception):
            job.run(as_of=date(2026, 6, 15))

    def test_initial_picks_query_failure_propagates(self, monkeypatch):
        class _BrokenClient:
            def table(self, _name):
                class _BrokenQuery:
                    def select(self, *a, **k):
                        raise Exception("connection refused")

                return _BrokenQuery()

        monkeypatch.setattr(job, "get_supabase_client", lambda: _BrokenClient())
        monkeypatch.setattr(job, "get_price_history", lambda *a, **k: pytest.fail("should not reach price fetch"))

        with pytest.raises(Exception):
            job.run(as_of=date(2026, 6, 15))
