from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from postgrest.exceptions import APIError

from app.services.user_service import get_supabase_client


class DailyPlanLimitExceeded(Exception):
    """Raised when a user already has a generation for the current UTC day."""


def today_utc() -> str:
    """Return today's date in UTC as an ISO string.

    Uses UTC (not local time) so this matches the ai_plan_generations
    generated_on column default: timezone('utc', now())::date.
    """
    return datetime.now(timezone.utc).date().isoformat()


async def reserve_daily_generation(user_id: str, model: str, request_payload: dict[str, Any]) -> str:
    """Reserve today's one AI-generation slot with a unique DB insert.

    Relies on the ai_plan_generations_user_day_unique (user_id, generated_on)
    constraint to enforce the limit atomically. If a row already exists for the
    user today, the insert fails and we raise DailyPlanLimitExceeded.
    """
    supabase = get_supabase_client()
    generation_id = str(uuid4())
    row = {
        "id": generation_id,
        "user_id": user_id,
        "generated_on": today_utc(),
        "status": "pending",
        "provider": "gemini",
        "model": model,
        "request_payload": request_payload,
    }

    try:
        supabase.table("ai_plan_generations").insert(row).execute()
    except APIError as exc:
        message = str(exc)
        if "ai_plan_generations_user_day_unique" in message or "duplicate key" in message.lower():
            raise DailyPlanLimitExceeded(
                "You already generated an AI plan today. Please try again tomorrow."
            ) from exc
        raise

    return generation_id


async def complete_daily_generation(generation_id: str, response_payload: dict[str, Any]) -> None:
    """Mark a reserved generation as completed and store its response payload."""
    supabase = get_supabase_client()
    supabase.table("ai_plan_generations").update({
        "status": "completed",
        "response_payload": response_payload,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", generation_id).execute()


async def release_failed_generation(generation_id: str, error_message: str) -> None:
    """Mark and remove a failed reservation so provider errors don't consume the day."""
    supabase = get_supabase_client()
    supabase.table("ai_plan_generations").update({
        "status": "failed",
        "error_message": error_message[:1000],
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", generation_id).execute()
    supabase.table("ai_plan_generations").delete().eq("id", generation_id).eq("status", "failed").execute()


async def get_today_generation(user_id: str) -> Optional[dict[str, Any]]:
    """Return the caller's generation row for the current UTC day, if any."""
    supabase = get_supabase_client()
    response = (
        supabase.table("ai_plan_generations")
        .select("id,generated_on,status,provider,model,created_at,completed_at")
        .eq("user_id", user_id)
        .eq("generated_on", today_utc())
        .limit(1)
        .execute()
    )
    return response.data[0] if response.data else None
