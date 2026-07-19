"""Tests for app.services.ai_plan_limit.

Exercises the daily one-generation-per-user-per-UTC-day enforcement without
touching a real Supabase instance. The Supabase client is replaced by an
in-memory stub via the `patched_supabase` fixture (see conftest.py).

These are plain synchronous pytest functions: the async service functions are
driven with asyncio.run so the suite needs no extra pytest plugins.
"""

from __future__ import annotations

import asyncio
import pytest

from app.services.ai_plan_limit import (
    DailyPlanLimitExceeded,
    complete_daily_generation,
    get_today_generation,
    release_failed_generation,
    reserve_daily_generation,
    today_utc,
)


def test_today_utc_returns_iso_date():
    value = today_utc()
    # YYYY-MM-DD per date.isoformat()
    assert len(value) == 10 and value[4] == "-" and value[7] == "-"
    assert "T" not in value  # must be a bare date, not a datetime


def test_reserve_creates_row_with_user_and_today(patched_supabase):
    generation_id = asyncio.run(
        reserve_daily_generation(
            user_id="user-123",
            model="gemini-2.0-flash",
            request_payload={"monthly_investment_amount": 500},
        )
    )

    assert generation_id  # returns the generated uuid string
    inserts = [c for c in patched_supabase.calls if c["method"] == "insert"]
    assert len(inserts) == 1
    row = inserts[0]["payload"]
    assert row["user_id"] == "user-123"
    assert row["generated_on"] == today_utc()
    assert row["status"] == "pending"
    assert row["provider"] == "gemini"
    assert row["model"] == "gemini-2.0-flash"
    assert row["request_payload"] == {"monthly_investment_amount": 500}
    # id must be present and equal the returned id
    assert row["id"] == generation_id


def test_reserve_duplicate_key_raises_daily_limit_exceeded(patched_supabase):
    from conftest import make_api_error

    patched_supabase.set_insert_error(make_api_error())

    with pytest.raises(DailyPlanLimitExceeded) as exc_info:
        asyncio.run(
            reserve_daily_generation(
                user_id="user-123", model="gemini-2.0-flash", request_payload={}
            )
        )
    assert "already generated" in str(exc_info.value).lower()


def test_reserve_other_api_error_is_reraised(patched_supabase):
    from postgrest.exceptions import APIError

    patched_supabase.set_insert_error(
        APIError({"message": "connection refused", "code": "XX000"})
    )

    with pytest.raises(APIError):
        asyncio.run(
            reserve_daily_generation(
                user_id="user-123", model="gemini-2.0-flash", request_payload={}
            )
        )


def test_complete_updates_status_and_payload(patched_supabase):
    asyncio.run(
        complete_daily_generation(
            generation_id="gen-1",
            response_payload={"portfolio_name": "Test Plan", "warnings": []},
        )
    )

    updates = [c for c in patched_supabase.calls if c["method"] == "update"]
    assert len(updates) == 1
    payload = updates[0]["payload"]
    assert payload["status"] == "completed"
    assert payload["response_payload"]["portfolio_name"] == "Test Plan"
    assert payload["completed_at"]


def test_release_failed_marks_and_deletes(patched_supabase):
    asyncio.run(release_failed_generation(generation_id="gen-1", error_message="boom"))

    updates = [c for c in patched_supabase.calls if c["method"] == "update"]
    deletes = [c for c in patched_supabase.calls if c["method"] == "delete"]
    assert len(updates) == 1
    assert updates[0]["payload"]["status"] == "failed"
    assert updates[0]["payload"]["error_message"] == "boom"
    assert len(deletes) == 1


def test_release_failed_truncates_long_error_message(patched_supabase):
    long_message = "x" * 2000
    asyncio.run(
        release_failed_generation(generation_id="gen-1", error_message=long_message)
    )

    updates = [c for c in patched_supabase.calls if c["method"] == "update"]
    assert len(updates[0]["payload"]["error_message"]) <= 1000


def test_get_today_generation_returns_single_row(patched_supabase):
    patched_supabase.set_today_rows(
        [
            {
                "id": "gen-1",
                "generated_on": today_utc(),
                "status": "completed",
                "provider": "gemini",
                "model": "gemini-2.0-flash",
                "created_at": "2026-01-01T00:00:00Z",
                "completed_at": "2026-01-01T00:01:00Z",
            }
        ]
    )

    result = asyncio.run(get_today_generation("user-123"))
    assert result is not None
    assert result["status"] == "completed"

    # select should target the ai_plan_generations table
    selects = [c for c in patched_supabase.calls if c["method"] == "select"]
    assert selects[0]["table"] == "ai_plan_generations"


def test_get_today_generation_returns_none_when_empty(patched_supabase):
    patched_supabase.set_today_rows([])
    assert asyncio.run(get_today_generation("user-123")) is None
