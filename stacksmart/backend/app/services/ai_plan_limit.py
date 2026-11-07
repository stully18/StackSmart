"""Backend-only generation audit metadata; no application generation quotas."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4
from starlette.concurrency import run_in_threadpool

from app.services.planning_storage import get_supabase_client


def today_utc() -> str:
    return datetime.now(timezone.utc).date().isoformat()


async def reserve_daily_generation(user_id: str, model: str, request_payload: dict[str, Any]) -> str:
    """Start a UUID generation record without daily slots or financial snapshots."""
    generation_id = str(uuid4())
    await run_in_threadpool(lambda: get_supabase_client().table("ai_plan_generations").insert({
        "id": generation_id, "user_id": user_id, "generated_on": today_utc(),
        "status": "pending", "provider": "openrouter", "model": model,
        "request_payload": {},
    }).execute())
    return generation_id


async def complete_daily_generation(generation_id: str, response_payload: dict[str, Any]) -> None:
    metadata = {"model": response_payload["ai_model"]} if response_payload.get("ai_model") else {}
    await run_in_threadpool(lambda: get_supabase_client().table("ai_plan_generations").update({
        **metadata, "status": "completed", "completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", generation_id).eq("status", "pending").execute())


async def release_failed_generation(generation_id: str, error_message: str) -> None:
    # Store only a known error category/reference, never an arbitrary exception with user data.
    await run_in_threadpool(lambda: get_supabase_client().table("ai_plan_generations").update({
        "status": "failed", "error_message": "generation_failed",
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", generation_id).eq("status", "pending").execute())


async def get_generation_status(user_id: str) -> dict[str, Any]:
    """Exact count plus one bounded metadata row, scoped to the authenticated user."""
    table = get_supabase_client().table("ai_plan_generations")
    response = await run_in_threadpool(lambda: table.select("id,generated_on,status,provider,model,created_at,completed_at", count="exact")
        .eq("user_id", user_id).eq("generated_on", today_utc())
        .in_("status", ["pending", "completed"]).order("created_at", desc=True).limit(1).execute())
    return {"unlimited": True, "limit": None, "remaining": None, "used_today": False,
            "used_count": response.count or 0,
            "generation": response.data[0] if response.data else None}
