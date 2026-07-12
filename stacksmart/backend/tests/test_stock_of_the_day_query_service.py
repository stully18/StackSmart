"""Unit tests for the Stock of the Day read-only query service."""

import pytest

from app.services import stock_of_the_day_query_service as query_service


class _FakeQuery:
    def __init__(self, rows):
        self._rows = rows

    def select(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        return type("Result", (), {"data": self._rows})()


class _FakeTable:
    def __init__(self, rows):
        self._rows = rows

    def select(self, *args, **kwargs):
        return _FakeQuery(self._rows).select(*args, **kwargs)


class _FakeClient:
    def __init__(self, rows_by_table):
        self._rows_by_table = rows_by_table

    def table(self, name):
        return _FakeTable(self._rows_by_table.get(name, []))


def _patch_client(monkeypatch, rows_by_table):
    monkeypatch.setattr(
        query_service, "get_supabase_client", lambda: _FakeClient(rows_by_table)
    )


class TestGetLatestPick:
    def test_returns_first_row(self, monkeypatch):
        rows = [{"ticker": "AAPL", "pick_date": "2026-07-10"}]
        _patch_client(monkeypatch, {"stock_of_the_day_picks": rows})

        assert query_service.get_latest_pick() == rows[0]

    def test_returns_none_when_empty(self, monkeypatch):
        _patch_client(monkeypatch, {"stock_of_the_day_picks": []})

        assert query_service.get_latest_pick() is None


class TestGetPickHistory:
    def test_returns_rows(self, monkeypatch):
        rows = [
            {"ticker": "AAPL", "pick_date": "2026-07-10"},
            {"ticker": "MSFT", "pick_date": "2026-07-09"},
        ]
        _patch_client(monkeypatch, {"stock_of_the_day_picks": rows})

        assert query_service.get_pick_history(30) == rows


class TestGetPerformanceSummary:
    def test_computes_window_stats(self):
        records = [
            {"return_1d": 0.02, "spy_return_1d": 0.01, "return_5d": None, "spy_return_5d": None,
             "return_20d": None, "spy_return_20d": None},
            {"return_1d": -0.01, "spy_return_1d": 0.005, "return_5d": 0.03, "spy_return_5d": 0.02,
             "return_20d": None, "spy_return_20d": None},
        ]

        summary = query_service.get_performance_summary(records)

        assert summary["1d"]["sample_size"] == 2
        assert summary["1d"]["win_rate_vs_spy"] == pytest.approx(0.5)
        assert summary["5d"]["sample_size"] == 1
        assert summary["5d"]["win_rate_vs_spy"] == pytest.approx(1.0)
        assert summary["20d"] is None

    def test_empty_records_returns_all_none(self):
        summary = query_service.get_performance_summary([])

        assert summary == {"1d": None, "5d": None, "20d": None}
