"""Shared pytest fixtures for StackSmart backend unit tests.

Keeps the test runner from importing real network-backed modules. The Supabase
client is replaced with an in-memory chainable stub so the daily-plan-limit
service can be exercised without a database.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import pytest
from postgrest.exceptions import APIError
from unittest.mock import patch

# Ensure `app` is importable when pytest is invoked from the backend dir.
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


class FakeExecute:
    """Mirrors the real postgrest response object (exposes `.data`)."""

    def __init__(self, data: Any = None, raise_error: Exception | None = None):
        self.data = data
        self._raise_error = raise_error

    def execute(self):
        if self._raise_error is not None:
            raise self._raise_error
        return self


class FakeSupabaseClient:
    """Minimal chainable stand-in for the Supabase client used by ai_plan_limit."""

    def __init__(self):
        self.calls: list[dict[str, Any]] = []
        self._insert_error: Exception | None = None
        self._today_rows: list[dict[str, Any]] = []

    def set_insert_error(self, error: Exception | None) -> None:
        self._insert_error = error

    def set_today_rows(self, rows: list[dict[str, Any]]) -> None:
        self._today_rows = rows

    def table(self, name: str) -> "FakeTable":
        return FakeTable(self, name)


class FakeTable:
    def __init__(self, client: FakeSupabaseClient, name: str):
        self._client = client
        self._name = name
        self._method = ""
        self._payload: Any = None
        self._eqs: list[Any] = []
        self._select: Any = None
        self._limit: int | None = None

    def insert(self, payload: Any) -> "FakeTable":
        self._method = "insert"
        self._payload = payload
        self._client.calls.append({"method": "insert", "table": self._name, "payload": payload})
        return self

    def update(self, payload: Any) -> "FakeTable":
        self._method = "update"
        self._payload = payload
        self._client.calls.append({"method": "update", "table": self._name, "payload": payload})
        return self

    def select(self, *args: Any) -> "FakeTable":
        self._method = "select"
        self._select = args
        self._client.calls.append({"method": "select", "table": self._name, "args": args})
        return self

    def delete(self) -> "FakeTable":
        self._method = "delete"
        self._client.calls.append({"method": "delete", "table": self._name})
        return self

    def eq(self, *args: Any) -> "FakeTable":
        self._eqs.append(args)
        return self

    def limit(self, n: int) -> "FakeTable":
        self._limit = n
        return self

    def in_(self, *args: Any) -> "FakeTable":
        self._eqs.append(("in", *args))
        return self

    def order(self, *args: Any, **kwargs: Any) -> "FakeTable":
        self._client.calls.append({"method": "order", "table": self._name, "args": args, "kwargs": kwargs})
        return self

    def execute(self):
        # INSERT path: honour a configured error (e.g. duplicate-key).
        if self._method == "insert" and self._client._insert_error is not None:
            raise self._client._insert_error
        if self._method == "select":
            return FakeExecute(data=self._client._today_rows)
        return FakeExecute(data=[])


@pytest.fixture
def fake_client():
    return FakeSupabaseClient()


@pytest.fixture
def patched_supabase(fake_client):
    """Patch get_supabase_client so ai_plan_limit uses the in-memory stub."""
    with patch(
        "app.services.ai_plan_limit.get_supabase_client", return_value=fake_client
    ):
        yield fake_client


def make_api_error(constraint: str = "ai_plan_generations_user_day_number_unique") -> APIError:
    """Build an APIError whose string form contains the unique-constraint name."""
    return APIError(
        {
            "message": f'duplicate key value violates unique constraint "{constraint}"',
            "code": "23505",
            "details": None,
        }
    )
