"""Generation tracking is unlimited and excludes duplicate financial snapshots."""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import patch
from app.services import ai_plan_limit as audit


def test_more_than_ten_uuid_records_without_financial_snapshots(patched_supabase):
    ids=[]
    for _ in range(15):
        identifier=asyncio.run(audit.reserve_daily_generation("user-a","nemotron",{"private":"finance"}))
        ids.append(identifier)
        asyncio.run(audit.complete_daily_generation(identifier,{"private":"advice","ai_model":"nemotron"}))
    assert len(set(ids))==15
    inserts=[call["payload"] for call in patched_supabase.calls if call["method"]=="insert"]
    assert all(row["request_payload"]=={} and "generation_number" not in row for row in inserts)
    updates=[call["payload"] for call in patched_supabase.calls if call["method"]=="update"]
    assert all("response_payload" not in row for row in updates)


def test_concurrent_generations_do_not_share_numbered_slots(patched_supabase):
    with ThreadPoolExecutor(max_workers=8) as pool:
        ids=list(pool.map(lambda _:asyncio.run(audit.reserve_daily_generation("user-a","nemotron",{})),range(24)))
    assert len(set(ids))==24


def test_failed_generation_retains_safe_metadata(patched_supabase):
    asyncio.run(audit.release_failed_generation("id","secret financial inputs"))
    update=[call["payload"] for call in patched_supabase.calls if call["method"]=="update"][0]
    assert update["status"]=="failed" and update["error_message"]=="generation_failed"
    assert not any(call["method"]=="delete" for call in patched_supabase.calls)


def test_status_is_unlimited_bounded_and_scoped():
    calls=[]
    class Query:
        def table(self,name):return self
        def select(self,columns,**kwargs):calls.append(("columns",columns));assert kwargs["count"]=="exact";return self
        def eq(self,key,value):calls.append((key,value));return self
        def in_(self,*args):return self
        def order(self,*args,**kwargs):return self
        def limit(self,n):assert n==1;return self
        def execute(self):return SimpleNamespace(count=15,data=[{"id":"latest","status":"completed"}])
    with patch.object(audit,"get_supabase_client",return_value=Query()):
        status=asyncio.run(audit.get_generation_status("user-a"))
    assert status["unlimited"] is True and status["limit"] is None and status["remaining"] is None
    assert status["used_count"]==15 and status["used_today"] is False
    assert ("user_id","user-a") in calls
    assert "payload" not in dict(calls)["columns"]
