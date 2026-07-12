"""Unit tests for the Postgres-backed TTL cache wrapper."""

from datetime import datetime, timedelta, timezone

import pytest

from app.services import market_data_cache_service as cache_service


class _FakeQuery:
    def __init__(self, rows):
        self._rows = rows

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
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
        return type("Result", (), {"data": None})()


class _FakeTable:
    """Routes .table("market_data_cache") to select or upsert fakes depending
    on which method is called next, mirroring the real supabase-py builder."""

    def __init__(self, existing_rows, upsert_calls):
        self._existing_rows = existing_rows
        self._upsert_calls = upsert_calls

    def select(self, *args, **kwargs):
        return _FakeQuery(self._existing_rows).select(*args, **kwargs)

    def upsert(self, payload, on_conflict=None):
        return _FakeUpsertQuery(self._upsert_calls).upsert(payload, on_conflict=on_conflict)


class _FakeClient:
    def __init__(self, existing_rows, upsert_calls):
        self._existing_rows = existing_rows
        self._upsert_calls = upsert_calls

    def table(self, _name):
        return _FakeTable(self._existing_rows, self._upsert_calls)


def _patch_client(monkeypatch, existing_rows, upsert_calls):
    monkeypatch.setattr(
        cache_service, "get_supabase_client", lambda: _FakeClient(existing_rows, upsert_calls)
    )


class TestGetCachedOrFetch:
    def test_cache_miss_calls_fetch_and_stores(self, monkeypatch):
        upsert_calls = []
        _patch_client(monkeypatch, existing_rows=[], upsert_calls=upsert_calls)

        fetch_calls = []
        def fetch_fn():
            fetch_calls.append(1)
            return {"value": 42}

        result = cache_service.get_cached_or_fetch("alpha_vantage", "key1", 3600, fetch_fn)

        assert result == {"value": 42}
        assert len(fetch_calls) == 1
        assert len(upsert_calls) == 1
        assert upsert_calls[0]["payload"]["provider"] == "alpha_vantage"
        assert upsert_calls[0]["payload"]["cache_key"] == "key1"
        assert upsert_calls[0]["payload"]["response"] == {"value": 42}
        assert upsert_calls[0]["on_conflict"] == "provider,cache_key"

    def test_fresh_cache_hit_skips_fetch(self, monkeypatch):
        fresh_row = {
            "response": {"value": "cached"},
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "ttl_seconds": 3600,
        }
        upsert_calls = []
        _patch_client(monkeypatch, existing_rows=[fresh_row], upsert_calls=upsert_calls)

        fetch_calls = []
        def fetch_fn():
            fetch_calls.append(1)
            return {"value": "fresh"}

        result = cache_service.get_cached_or_fetch("yfinance", "key2", 3600, fetch_fn)

        assert result == {"value": "cached"}
        assert len(fetch_calls) == 0
        assert len(upsert_calls) == 0

    def test_expired_cache_refetches(self, monkeypatch):
        stale_row = {
            "response": {"value": "stale"},
            "fetched_at": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
            "ttl_seconds": 3600,
        }
        upsert_calls = []
        _patch_client(monkeypatch, existing_rows=[stale_row], upsert_calls=upsert_calls)

        result = cache_service.get_cached_or_fetch("yfinance", "key3", 3600, lambda: {"value": "new"})

        assert result == {"value": "new"}
        assert len(upsert_calls) == 1

    def test_read_failure_falls_back_to_fetch(self, monkeypatch):
        class _Query:
            def select(self, *a, **k):
                raise Exception("connection refused")

            def upsert(self, *a, **k):
                return self

            def execute(self):
                return type("Result", (), {"data": None})()

        class _BrokenSelectClient:
            def table(self, _name):
                return _Query()

        monkeypatch.setattr(cache_service, "get_supabase_client", lambda: _BrokenSelectClient())

        # The read is broken (simulating Supabase being briefly unavailable),
        # but that must degrade to a cache miss and still return the fetched
        # value, not abort the whole call.
        result = cache_service.get_cached_or_fetch("alpha_vantage", "key4", 3600, lambda: {"value": "fetched"})

        assert result == {"value": "fetched"}

    def test_write_failure_still_returns_fetched_result(self, monkeypatch):
        class _ReadOkWriteBrokenClient:
            def table(self, _name):
                class _Query:
                    def select(self, *a, **k):
                        return self

                    def eq(self, *a, **k):
                        return self

                    def execute(self):
                        return type("Result", (), {"data": []})()

                    def upsert(self, *a, **k):
                        raise Exception("write failed")

                return _Query()

        monkeypatch.setattr(cache_service, "get_supabase_client", lambda: _ReadOkWriteBrokenClient())

        result = cache_service.get_cached_or_fetch("alpha_vantage", "key5", 3600, lambda: {"value": "fetched"})

        assert result == {"value": "fetched"}

    def test_fetch_fn_failure_propagates_and_is_not_cached(self, monkeypatch):
        upsert_calls = []
        _patch_client(monkeypatch, existing_rows=[], upsert_calls=upsert_calls)

        def failing_fetch():
            raise ValueError("upstream API failed")

        with pytest.raises(ValueError):
            cache_service.get_cached_or_fetch("alpha_vantage", "key6", 3600, failing_fetch)

        assert len(upsert_calls) == 0
