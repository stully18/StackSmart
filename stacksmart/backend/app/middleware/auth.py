from fastapi import HTTPException, Request
from supabase import create_client, Client
import os

def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    return create_client(url, key)

async def verify_user_token(request: Request) -> str:
    """Extract and verify Supabase token from Authorization header"""
    auth_header = request.headers.get("Authorization")

    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = auth_header.split(" ")[1]

    # Verify token with Supabase
    supabase = get_supabase_client()
    try:
        response = supabase.auth.get_user(token)
        return response.user.id
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")
