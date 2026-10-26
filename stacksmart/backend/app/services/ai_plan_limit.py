from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional, cast
from uuid import uuid4

from postgrest.exceptions import APIError

from app.services.user_service import get_supabase_client


DAILY_AI_PLAN_LIMIT = 10


class DailyPlanLimitExceeded(Exception):
    """Raised when a user has used every AI generation slot for the current UTC day."""


def today_utc() -> str:
    """Return today's date in UTC as an ISO string.

    Uses UTC (not local time) so this matches the ai_plan_generations
    generated_on column default: timezone('utc', now())::date.
    """
    return datetime.now(timezone.utc).date().isoformat()


def _used_generation_numbers(rows: list[dict[str, Any]]) -> set[int]:
    used = set()
    for row in rows:
        number = row.get("generation_number")
        if isinstance(number, int):
            used.add(number)
    return used


def _limit_message() -> str:
    return f"You already generated {DAILY_AI_PLAN_LIMIT} AI plans today. Please try again tomorrow."


async def get_today_generations(user_id: str) -> list[dict[str, Any]]:
    """Return today's pending/completed generation rows for the caller."""
    supabase = get_supabase_client()
    response = (
        supabase.table("ai_plan_generations")
        .select("id,generated_on,status,provider,model,generation_number,created_at,completed_at")
        .eq("user_id", user_id)
        .eq("generated_on", today_utc())
        .in_("status", ["pending", "completed"])
        .order("generation_number", desc=False)
        .limit(DAILY_AI_PLAN_LIMIT)
        .execute()
    )
    return cast(list[dict[str, Any]], response.data or [])


async def reserve_daily_generation(user_id: str, model: str, request_payload: dict[str, Any]) -> str:
    """Reserve one of today's AI-generation slots.

    The ai_plan_generations_user_day_number_unique constraint keeps each
    generation_number unique per user/day. We choose the first open slot from
    1..DAILY_AI_PLAN_LIMIT; if all slots are occupied, the user is limited.
    """
    supabase = get_supabase_client()
    today_rows = await get_today_generations(user_id)
    used_numbers = _used_generation_numbers(today_rows)
    if len(used_numbers) >= DAILY_AI_PLAN_LIMIT:
        raise DailyPlanLimitExceeded(_limit_message())

    for generation_number in range(1, DAILY_AI_PLAN_LIMIT + 1):
        if generation_number in used_numbers:
            continue

        generation_id = str(uuid4())
        row = {
            "id": generation_id,
            "user_id": user_id,
            "generated_on": today_utc(),
            "generation_number": generation_number,
            "status": "pending",
            "provider": "gemini",
            "model": model,
            "request_payload": request_payload,
        }

        try:
            supabase.table("ai_plan_generations").insert(row).execute()
            return generation_id
        except APIError as exc:
            message = str(exc)
            is_slot_race = (
                "ai_plan_generations_user_day_number_unique" in message
                or "duplicate key" in message.lower()
            )
            if not is_slot_race:
                raise
            # Another request took this slot after our read. Try the next slot;
            # if every slot races/fills, surface the daily limit.
            continue

    raise DailyPlanLimitExceeded(_limit_message())


async def complete_daily_generation(generation_id: str, response_payload: dict[str, Any]) -> None:
    """Mark a reserved generation as completed and store its response payload."""
    supabase = get_supabase_client()
    supabase.table("ai_plan_generations").update({
        "status": "completed",
        "response_payload": response_payload,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", generation_id).execute()


async def release_failed_generation(generation_id: str, error_message: str) -> None:
    """Mark and remove a failed reservation so provider errors don't consume a slot."""
    supabase = get_supabase_client()
    supabase.table("ai_plan_generations").update({
        "status": "failed",
        "error_message": error_message[:1000],
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", generation_id).execute()
    supabase.table("ai_plan_generations").delete().eq("id", generation_id).eq("status", "failed").execute()


async def get_today_generation(user_id: str) -> Optional[dict[str, Any]]:
    """Return the caller's latest generation row for today, if any."""
    rows = await get_today_generations(user_id)
    return rows[-1] if rows else None
