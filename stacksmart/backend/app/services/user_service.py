from supabase import create_client, Client
import os
from uuid import UUID

def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    return create_client(url, key)

async def save_financial_plan(user_id: str, plan_name: str, plan_type: str, data: dict):
    """Save a financial plan to the database"""
    supabase = get_supabase_client()

    response = supabase.table("financial_data").upsert({
        "user_id": user_id,
        "plan_name": plan_name,
        "plan_type": plan_type,
        "data": data
    }).execute()

    return response.data

async def get_user_plans(user_id: str):
    """Get all saved plans for a user"""
    supabase = get_supabase_client()

    response = supabase.table("financial_data").select("*").eq("user_id", user_id).execute()

    return response.data

async def delete_plan(user_id: str, plan_name: str):
    """Delete a specific plan"""
    supabase = get_supabase_client()

    response = supabase.table("financial_data").delete().eq("user_id", user_id).eq("plan_name", plan_name).execute()

    return {"deleted": True}
